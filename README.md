# OneRoster Sample Generator

Generates fake OneRoster 1.1 CSV rosters for testing. Run it as an HTTP API so QA
can pull samples on demand, or as a CLI for local files and CI fixtures. Zero
dependencies, so there is no install step beyond having Node 16+.

## Quick start

API:

```
node src/server.js          # listens on http://localhost:4400
```

Open `http://localhost:4400` for a small form (pick type/size, download a zip), or
hit the endpoint directly:

```
curl -OJ "http://localhost:4400/generate?type=district&size=large&domain=sample.edu"
```

CLI:

```
node src/cli.js --type school --size small --zip --out ./out
```

## Parameters

| param  | values                          | default | notes                                  |
| ------ | ------------------------------- | ------- | -------------------------------------- |
| type   | school, district                | school  | school is one campus; district is many |
| size   | small, medium, large            | medium  | scales students, classes, and schools  |
| domain | any email domain                | derived | derived from the org name if omitted   |
| level  | elementary, middle, high, k12   | by size | type=school only; grade span           |
| seed   | any string or number            | random  | same seed reproduces the same roster   |
| asOf   | ISO datetime                    | now     | pins dateLastModified and school year  |

`seed` fully determines all generated content (names, ids, structure), which makes
regression fixtures repeatable. `dateLastModified` is a real timestamp, so pin
`asOf` too when you need byte-for-byte identical output.

## HTTP API

- `GET /` form UI for click-to-download
- `GET /health` liveness plus valid type/size values
- `GET /generate?type=&size=&domain=&level=&seed=&asOf=&format=` generate
- `POST /generate` same params as a JSON body

`format=zip` (default) returns a zip of the CSV set with `Content-Disposition`,
plus `X-OneRoster-Seed` and `X-OneRoster-Counts` headers. `format=json` returns
`{ meta, files }` where `files` maps each filename to its CSV text, handy for
programmatic diffing.

## Naming scheme

Names are combinatorial and obviously fake, so test data never resembles a real
person or school:

- School: `Raspberry James Elementary School` (flavor + person + level)
- District: `Marigold Valley Unified School District` (flavor + geo + type)
- Class: `Preposterous Platypus`, `Pink Elephant` (adjective + animal)
- Person: `Jamika Jellyroll` (given name + whimsical surname)

Word banks live in `src/naming.js`. Add words there to widen the pool.

## Output

The generated set is standard OneRoster 1.1 CSV, packaged as a zip:

```
academicSessions.csv  orgs.csv    courses.csv   classes.csv
users.csv             enrollments.csv           demographics.csv
manifest.csv
```

Structure: one school year and a full-year term; a course catalog per grade and
subject at the top org (district for a district, the school otherwise); class
sections sized to fit each grade; students enrolled one section per subject with a
teacher per section; a principal per school and a district administrator.

## Spec conformance

Header spelling and column order follow the 1EdTech OneRoster 1.1 CSV binding,
which is case-sensitive and order-locked. This was verified against the 1EdTech
tables, not the bergerb reference repo, which deviated in four places worth
knowing if you compare output:

- `classes.csv` uses `termSourcedIds` (plural), not `termSourcedId`
- `enrollments.csv` has no `courseSourcedId` column
- `users.csv` places `agentSourcedIds` after `phone`, not mid-name
- `demographics.csv` uses `stateOfBirthAbbreviation` (capital O)

`username` is a plain handle, not an email, since several OneRoster consumers
reject an email address in that field.

If your real sample roster targets 1.2 or a vendor profile with different columns,
edit the arrays in `src/csv.js`; the generator keys rows by header name, so header
changes flow through.

## Auth

Set `ONEROSTER_TOKEN` on the host and every `/generate` request must present it.
Leave it unset for local or CI use and the endpoint is open (the server logs a
warning at startup so a forgotten token on the droplet is obvious). `/health` and
the form page stay open either way.

Generate a secret and pass it three ways:

```
export ONEROSTER_TOKEN=$(openssl rand -hex 24)

curl -H "Authorization: Bearer $ONEROSTER_TOKEN" -OJ "http://host:4400/generate?type=school&size=small"
curl -H "X-Auth-Token: $ONEROSTER_TOKEN"        -OJ "http://host:4400/generate?type=school&size=small"
curl -OJ "http://host:4400/generate?type=school&size=small&token=$ONEROSTER_TOKEN"
```

The browser form has a token field, so the query-param form is there for that and
for quick curls. It lands in server/proxy logs, so prefer a header for anything
scripted. This is a single shared secret, not per-user accounts; pair it with the
DO firewall or nginx basic auth if you want more than one layer.

## Deploy

The app has no auth of its own, so keep it off the open internet: bind to
loopback behind a reverse proxy, or restrict the port with a DigitalOcean Cloud
Firewall to QA/VPN addresses.

Droplet (systemd):

```
sudo useradd --system --no-create-home oneroster
sudo mkdir -p /opt/oneroster-gen && sudo rsync -a ./ /opt/oneroster-gen/
sudo chown -R oneroster:oneroster /opt/oneroster-gen
sudo cp deploy/oneroster-gen.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now oneroster-gen
```

The unit binds `127.0.0.1:4400` by default. Put nginx in front for a hostname,
TLS, and basic auth (`deploy/nginx-oneroster.conf`), or set `HOST=0.0.0.0` and
lock the port down with a DO firewall. Container option: `docker build -t
oneroster-gen . && docker run -p 4400:4400 oneroster-gen`.

App Platform (no server to manage): `deploy/do-app.yaml` builds straight from the
GitHub repo and gives you HTTPS and a URL. `doctl apps create --spec
deploy/do-app.yaml` after setting your repo in the spec.

## License

MIT (see `LICENSE`). Simple and permissive, the common default for a small utility
like this. Swap the copyright holder if you'd rather use an org name or handle.

## Files

```
src/generator.js  core dataset builder (pure, deterministic)
src/naming.js     creative name factory + word banks
src/csv.js        CSV serialization + OneRoster 1.1 layouts
src/zip.js        zero-dependency store-only zip writer
src/server.js     HTTP API + form
src/cli.js        command line entry point
test/smoke.js     spec headers, referential integrity, determinism, zip
```

## Tests

```
node test/smoke.js
```

Checks that headers match the spec exactly, that every foreign key resolves
(enrollments to classes and users, classes to courses and schools, and so on),
that a seed reproduces identical output while a different seed diverges, and that
the zip is a valid archive.
