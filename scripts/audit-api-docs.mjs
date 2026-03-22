import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const appFile = path.join(repoRoot, "api", "app.ts");
const apiDocsFile = path.join(repoRoot, "src", "pages", "ApiDocs.tsx");
const args = new Set(process.argv.slice(2));
const manifestOnly = args.has("--manifest-only");

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const AUTH_MARKERS = [
  "authenticateToken",
  "requireAdmin",
  "requireOrganization",
  "authenticateSSE",
];

const normalizePath = (value) => {
  if (!value) return "/";
  const collapsed = value.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
};

const readSource = (filePath, kind = ts.ScriptKind.TS) => {
  const text = fs.readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  return { text, source };
};

const walk = (node, cb) => {
  cb(node);
  ts.forEachChild(node, (child) => walk(child, cb));
};

const isRouterCall = (node, methodName) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === "router" &&
  node.expression.name.text === methodName;

const getStringLiteralValue = (node) => {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
};

const hasAuthMarker = (text) =>
  AUTH_MARKERS.some((marker) => text.includes(marker));

const parseAppMounts = () => {
  const { source } = readSource(appFile, ts.ScriptKind.TS);
  const importMap = new Map();
  const mounts = [];

  walk(source, (node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (!clause || !clause.name) return;
      const mod = node.moduleSpecifier;
      if (!ts.isStringLiteral(mod)) return;
      const spec = mod.text;
      if (!spec.startsWith("./routes/")) return;
      importMap.set(clause.name.text, spec);
      return;
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "app" &&
      node.expression.name.text === "use"
    ) {
      const [baseArg, routerArg] = node.arguments;
      const basePath = getStringLiteralValue(baseArg);
      if (!basePath || !basePath.startsWith("/api")) return;
      if (!routerArg || !ts.isIdentifier(routerArg)) return;
      const routeSpec = importMap.get(routerArg.text);
      if (!routeSpec) return;
      mounts.push({ basePath, routeSpec, routerVar: routerArg.text });
    }
  });

  return mounts;
};

const parseRouteFile = (absolutePath, basePath) => {
  const { source } = readSource(absolutePath, ts.ScriptKind.TS);
  let defaultProtected = false;
  const entries = [];

  walk(source, (node) => {
    if (isRouterCall(node, "use")) {
      const callText = node.getText(source);
      if (hasAuthMarker(callText)) {
        defaultProtected = true;
      }
      return;
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "router" &&
      ROUTE_METHODS.has(node.expression.name.text)
    ) {
      const method = node.expression.name.text.toUpperCase();
      const routePath = getStringLiteralValue(node.arguments[0]);
      if (!routePath) return;

      const restArgsText = node.arguments
        .slice(1)
        .map((arg) => arg.getText(source))
        .join(" ");
      const protectedRoute = defaultProtected || hasAuthMarker(restArgsText);

      entries.push({
        method,
        path: normalizePath(`${basePath}${routePath}`),
        protected: protectedRoute,
        source: path.relative(repoRoot, absolutePath),
      });
    }
  });

  return entries;
};

const parseActualRoutes = () => {
  const mounts = parseAppMounts();
  const routes = [];

  for (const mount of mounts) {
    const routeTsPath = mount.routeSpec.replace(/^\.\/routes\//, "");
    const absolutePath = path.join(
      repoRoot,
      "api",
      "routes",
      routeTsPath.replace(/\.js$/, ".ts"),
    );
    if (!fs.existsSync(absolutePath)) {
      console.warn(
        `Missing route file for mount ${mount.basePath}: ${absolutePath}`,
      );
      continue;
    }
    routes.push(...parseRouteFile(absolutePath, mount.basePath));
  }

  const deduped = new Map();
  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (!deduped.has(key)) {
      deduped.set(key, route);
    }
  }

  return Array.from(deduped.values()).sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  );
};

const templateToBasePath = (node) => {
  const raw = node.getText();
  if (raw.includes("${apiBase}")) {
    const suffix = raw.replace(/^`?\$\{apiBase\}/, "").replace(/`$/, "");
    return normalizePath(`/api${suffix}`);
  }
  const literal = getStringLiteralValue(node);
  return literal ? normalizePath(literal) : null;
};

const findObjectProp = (obj, propName) =>
  obj.properties.find(
    (prop) =>
      ts.isPropertyAssignment(prop) &&
      ((ts.isIdentifier(prop.name) && prop.name.text === propName) ||
        (ts.isStringLiteral(prop.name) && prop.name.text === propName)),
  );

const isPlaceholderResponse = (node) => {
  if (!node) return false;
  if (!ts.isObjectLiteralExpression(node)) return false;
  const props = node.properties;
  if (props.length !== 1) return false;
  const onlyProp = props[0];
  if (!ts.isPropertyAssignment(onlyProp)) return false;
  const name = onlyProp.name;
  if (ts.isIdentifier(name) && name.text === "success") {
    const value = onlyProp.initializer;
    if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  }
  return false;
};

const parseApiDocsSections = () => {
  const { source } = readSource(apiDocsFile, ts.ScriptKind.TSX);
  let sectionsArray = null;

  walk(source, (node) => {
    if (!ts.isVariableDeclaration(node)) return;
    if (!ts.isIdentifier(node.name)) return;
    if (!["sections", "baseSections"].includes(node.name.text)) return;
    if (!node.initializer || !ts.isCallExpression(node.initializer)) return;
    const [factoryArg] = node.initializer.arguments;
    if (!factoryArg || !ts.isArrowFunction(factoryArg)) return;

    if (ts.isArrayLiteralExpression(factoryArg.body)) {
      sectionsArray = factoryArg.body;
      return;
    }

    if (ts.isBlock(factoryArg.body)) {
      for (const stmt of factoryArg.body.statements) {
        if (ts.isReturnStatement(stmt) && stmt.expression) {
          if (ts.isArrayLiteralExpression(stmt.expression)) {
            sectionsArray = stmt.expression;
          }
        }
      }
    }
  });

  if (!sectionsArray) {
    throw new Error("Could not locate sections array in ApiDocs.tsx");
  }

  const sections = [];
  for (const element of sectionsArray.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const titleProp = findObjectProp(element, "title");
    const baseProp = findObjectProp(element, "base");
    const endpointsProp = findObjectProp(element, "endpoints");
    if (!titleProp || !baseProp || !endpointsProp) continue;
    if (
      !ts.isPropertyAssignment(titleProp) ||
      !ts.isPropertyAssignment(baseProp) ||
      !ts.isPropertyAssignment(endpointsProp)
    ) {
      continue;
    }

    const title = getStringLiteralValue(titleProp.initializer);
    const base = templateToBasePath(baseProp.initializer);
    if (!title || !base) continue;
    if (!ts.isArrayLiteralExpression(endpointsProp.initializer)) continue;

    const endpoints = [];
    for (const endpointNode of endpointsProp.initializer.elements) {
      if (!ts.isObjectLiteralExpression(endpointNode)) continue;
      const methodProp = findObjectProp(endpointNode, "method");
      const pathProp = findObjectProp(endpointNode, "path");
      const authProp = findObjectProp(endpointNode, "auth");
      const bodyProp = findObjectProp(endpointNode, "body");
      const paramsProp = findObjectProp(endpointNode, "params");
      const responseProp = findObjectProp(endpointNode, "response");

      if (!methodProp || !pathProp) continue;
      if (
        !ts.isPropertyAssignment(methodProp) ||
        !ts.isPropertyAssignment(pathProp)
      ) {
        continue;
      }

      const method = getStringLiteralValue(methodProp.initializer);
      const routePath = getStringLiteralValue(pathProp.initializer);
      if (!method || !routePath) continue;

      let auth = false;
      if (authProp && ts.isPropertyAssignment(authProp)) {
        if (
          authProp.initializer.kind === ts.SyntaxKind.TrueKeyword ||
          authProp.initializer.kind === ts.SyntaxKind.FalseKeyword
        ) {
          auth = authProp.initializer.kind === ts.SyntaxKind.TrueKeyword;
        }
      }

      const hasBody = bodyProp && ts.isPropertyAssignment(bodyProp);
      const hasParams = paramsProp && ts.isPropertyAssignment(paramsProp);
      const hasResponse = responseProp && ts.isPropertyAssignment(responseProp);
      const isPlaceholderResponseFlag = hasResponse && isPlaceholderResponse(responseProp.initializer);

      endpoints.push({
        sectionTitle: title,
        sectionBase: base,
        method: method.toUpperCase(),
        relativePath: routePath,
        path: normalizePath(`${base}${routePath}`),
        auth,
        hasBody,
        hasParams,
        hasResponse,
        isPlaceholderResponse: isPlaceholderResponseFlag,
      });
    }

    sections.push({
      title,
      base,
      endpoints,
    });
  }

  return sections;
};

const actualRoutes = parseActualRoutes();
const docSections = parseApiDocsSections();
const docEndpoints = docSections.flatMap((section) => section.endpoints);

const actualMap = new Map(
  actualRoutes.map((route) => [`${route.method} ${route.path}`, route]),
);
const docsMap = new Map(
  docEndpoints.map((endpoint) => [
    `${endpoint.method} ${endpoint.path}`,
    endpoint,
  ]),
);

const missingInDocs = [];
for (const [key, route] of actualMap.entries()) {
  if (!docsMap.has(key)) {
    missingInDocs.push(route);
  }
}

const staleInDocs = [];
for (const [key, endpoint] of docsMap.entries()) {
  if (!actualMap.has(key)) {
    staleInDocs.push(endpoint);
  }
}

const authMismatches = [];
for (const [key, route] of actualMap.entries()) {
  const docEndpoint = docsMap.get(key);
  if (!docEndpoint) continue;
  if (Boolean(route.protected) !== Boolean(docEndpoint.auth)) {
    authMismatches.push({
      key,
      actualProtected: route.protected,
      docsProtected: docEndpoint.auth,
      section: docEndpoint.sectionTitle,
    });
  }
}

// Check for incomplete documentation (missing body/params/response)
const incompleteDocs = [];
const needsBodyMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const needsParamsMethods = new Set(["GET"]);
for (const endpoint of docEndpoints) {
  const issues = [];
  // Only flag missing_body for POST/PUT/PATCH/DELETE that don't have body defined
  if (needsBodyMethods.has(endpoint.method) && !endpoint.hasBody) {
    issues.push("missing_body");
  }
  // Only flag missing_params for GET endpoints that don't have params defined
  // (POST/PUT/PATCH typically use body, not query params)
  if (needsParamsMethods.has(endpoint.method) && !endpoint.hasParams) {
    issues.push("missing_params");
  }
  if (!endpoint.hasResponse || endpoint.isPlaceholderResponse) {
    issues.push("missing_response");
  }
  if (issues.length > 0) {
    incompleteDocs.push({
      key: `${endpoint.method} ${endpoint.path}`,
      section: endpoint.sectionTitle,
      issues,
    });
  }
}

if (!manifestOnly) {
  console.log("=== API Docs Audit ===");
  console.log(`Actual endpoints: ${actualRoutes.length}`);
  console.log(
    `Actual protected endpoints: ${actualRoutes.filter((r) => r.protected).length}`,
  );
  console.log(`Documented endpoints: ${docEndpoints.length}`);
  console.log(
    `Documented protected endpoints: ${docEndpoints.filter((r) => r.auth).length}`,
  );
  console.log("");
  console.log(`Missing in docs: ${missingInDocs.length}`);
  console.log(`Stale in docs: ${staleInDocs.length}`);
  console.log(`Auth mismatches: ${authMismatches.length}`);
  console.log(`Incomplete docs (missing body/params/response): ${incompleteDocs.length}`);

  if (missingInDocs.length > 0) {
    console.log("\n-- Missing in docs (first 50) --");
    for (const route of missingInDocs.slice(0, 50)) {
      console.log(
        `${route.method} ${route.path} [protected=${route.protected}]`,
      );
    }
  }

  if (staleInDocs.length > 0) {
    console.log("\n-- Stale in docs (first 50) --");
    for (const endpoint of staleInDocs.slice(0, 50)) {
      console.log(
        `${endpoint.method} ${endpoint.path} [section=${endpoint.sectionTitle}]`,
      );
    }
  }

  if (authMismatches.length > 0) {
    console.log("\n-- Auth mismatches (first 50) --");
    for (const mismatch of authMismatches.slice(0, 50)) {
      console.log(
        `${mismatch.key} [docs=${mismatch.docsProtected}, actual=${mismatch.actualProtected}]`,
      );
    }
  }

  if (incompleteDocs.length > 0) {
    console.log("\n-- Incomplete docs (missing body/params/response) --");
    // Group by section
    const bySection = new Map();
    for (const doc of incompleteDocs) {
      if (!bySection.has(doc.section)) {
        bySection.set(doc.section, []);
      }
      bySection.get(doc.section).push(doc);
    }
    for (const [section, docs] of bySection) {
      console.log(`\n[${section}]`);
      for (const doc of docs) {
        console.log(`  ${doc.key} - ${doc.issues.join(", ")}`);
      }
    }
  }

  const reportPath = path.join(repoRoot, "data", "api-docs-audit-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        actualCount: actualRoutes.length,
        actualProtectedCount: actualRoutes.filter((r) => r.protected).length,
        docsCount: docEndpoints.length,
        docsProtectedCount: docEndpoints.filter((r) => r.auth).length,
        missingInDocs,
        staleInDocs,
        authMismatches,
        incompleteDocs,
        actualRoutes,
        docEndpoints,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `\nDetailed report written to ${path.relative(repoRoot, reportPath)}`,
  );

  // Write incomplete docs to separate file for easier review
  if (incompleteDocs.length > 0) {
    const incompleteReportPath = path.join(repoRoot, "data", "api-docs-incomplete.json");
    fs.writeFileSync(
      incompleteReportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalIncomplete: incompleteDocs.length,
          endpoints: incompleteDocs,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`Incomplete docs report written to ${path.relative(repoRoot, incompleteReportPath)}`);
  }
}


const manifestPath = path.join(repoRoot, "src", "lib", "apiRouteManifest.ts");
const manifestRoutes = actualRoutes.map((route) => ({
  method: route.method,
  path: route.path,
  protected: route.protected,
}));
const manifestContent = `export type ActiveApiRoute = {\n  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";\n  path: string;\n  protected: boolean;\n};\n\nexport const ACTIVE_API_ROUTE_MANIFEST: ActiveApiRoute[] = ${JSON.stringify(manifestRoutes, null, 2)};\n`;
fs.writeFileSync(manifestPath, manifestContent, "utf8");
console.log(`Route manifest refreshed at ${path.relative(repoRoot, manifestPath)}`);
