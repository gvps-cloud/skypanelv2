const fs = require('fs');
const file = 'src/components/admin/networking/IPAddressTable.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr = `{getAddressFamily(selectedIp) === "ipv6" && hasPrefixContext(selectedIp) ? (
                  <IPv6RangeRdnsEditor
                    prefixes={selectedIp.ipv6Prefixes!.map((prefix) => ({
                      range: prefix.range,
                      prefixLength: prefix.prefixLength,
                      region: prefix.region,
                      routeTarget: prefix.routeTarget,
                    }))}
                    title="Range-aware IPv6 reverse DNS"
                    description="Use range rDNS endpoints to edit sub-address records for the selected IPv6 prefix."
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] });
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="direct-rdns">Reverse DNS hostname</Label>
                      <Input
                        id="direct-rdns"
                        value={directRdns}
                        onChange={(event) => setDirectRdns(event.target.value)}
                        placeholder="host.example.com"
                        disabled={savingDirectRdns}
                      />
                      <p className="text-xs text-muted-foreground">
                        Direct address-level rDNS editing for IPv4 and standalone IPv6 rows.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => void saveDirectRdns()} disabled={savingDirectRdns}>
                        {savingDirectRdns ? "Saving..." : "Save rDNS"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDirectRdns("");
                          void saveDirectRdns("");
                        }}
                        disabled={savingDirectRdns}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}`;

const newStr = `<div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="direct-rdns">Reverse DNS hostname</Label>
                    <Input
                      id="direct-rdns"
                      value={directRdns}
                      onChange={(event) => setDirectRdns(event.target.value)}
                      placeholder="host.example.com"
                      disabled={savingDirectRdns}
                    />
                    <p className="text-xs text-muted-foreground">
                      Direct address-level rDNS editing for IPv4 and the primary IPv6 interface (SLAAC) address.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => void saveDirectRdns()} disabled={savingDirectRdns}>
                      {savingDirectRdns ? "Saving..." : "Save rDNS"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDirectRdns("");
                        void saveDirectRdns("");
                      }}
                      disabled={savingDirectRdns}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {getAddressFamily(selectedIp) === "ipv6" && hasPrefixContext(selectedIp) && (
                  <div className="border-t pt-4">
                    <IPv6RangeRdnsEditor
                      prefixes={selectedIp.ipv6Prefixes!.map((prefix) => ({
                        range: prefix.range,
                        prefixLength: prefix.prefixLength,
                        region: prefix.region,
                        routeTarget: prefix.routeTarget,
                      }))}
                      title="Range-aware IPv6 reverse DNS"
                      description="Use range rDNS endpoints to edit sub-address records for the selected IPv6 prefix."
                      onSaved={() => {
                        queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] });
                      }}
                    />
                  </div>
                )}`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Success");
} else {
  console.error("String not found");
}
