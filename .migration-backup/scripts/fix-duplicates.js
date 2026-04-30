const fs = require('fs');
let code = fs.readFileSync('src/lib/apiDocsShared.tsx', 'utf8');

// Clean up duplicate keys safely without worrying about shell escaping
code = code.replace(/(params:\s*\{\},\s*)+(params:)/g, '$2');
code = code.replace(/(params:\s*\{\},\s*)+/g, 'params: {}, ');

code = code.replace(/(body:\s*\{\},\s*)+(body:)/g, '$2');
code = code.replace(/(body:\s*\{\},\s*)+/g, 'body: {}, ');

// We might have lines like `response: { success: true },response: {`
code = code.replace(/response:\s*\{\s*success:\s*true\s*\},(\s*response:)/g, '$1');

// Double check for `params: { limit: 50, offset: 0 }` right after `params: {},`
code = code.replace(/params:\s*\{\},\s*(params:\s*\{[^}]+\})/g, '$1');
code = code.replace(/body:\s*\{\},\s*(body:\s*\{[^}]+\})/g, '$1');

fs.writeFileSync('src/lib/apiDocsShared.tsx', code, 'utf8');
console.log('Fixed duplicates');
