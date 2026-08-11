# Steinstossen AWS deployment

## Production model

The deployment follows the established SophiaWalker.ch, Limmat Sharks, and Old
Boys Basel pattern:

1. Pushes and pull requests to `master` run CI.
2. A `SteinStossen-vX.Y.Z` tag triggers CD.
3. GitHub Actions builds an immutable Docker image containing the committed SQLite
   database.
4. The image is published to GitHub Container Registry.
5. The AWS host pulls the exact release image and replaces only a `SteinStossen_*`
   container.
6. The container binds to localhost; Nginx provides the public HTTPS endpoint.

Production target:

| Setting | Value |
|---|---|
| Repository | `aboimpinto/SteinStossen` |
| Image | `ghcr.io/aboimpinto/steinstossen-website` |
| AWS host | `3.68.99.232` |
| SSH user | `ubuntu` |
| Domain | `steinstossen.aboimpinto.cloud-ip.cc` |
| Host bind | `127.0.0.1:3008` |
| Container port | `3000` |
| App root | `/opt/steinstossen` |
| Health check | `/api/health` |

Port `3008` was selected because existing portfolio services use `3003` through
`3007`. Confirm it remains free during the one-time server setup.

## SQLite deployment rule

`data/steinstossen.sqlite` is committed to Git and copied into the production image
at `/app/data/steinstossen.sqlite`. No external database service or persistent volume
is required for this read-only demonstration.

Consequences:

- every deployed dataset maps to an immutable image and Git release;
- a container replacement cannot lose user-generated data because the site has no
  mutable application data;
- refreshing the archive means rebuilding the SQLite file, reviewing
  `data/import-report.json`, committing both, and creating a new release tag;
- rollback means deploying an older tagged image, which also restores that release's
  database snapshot.

The CI workflow validates SQLite integrity and confirms all 305 result documents have
parsed rows before building the container.

## GitHub repository configuration

Repository variables:

| Variable | Value |
|---|---|
| `AWS_HOST` | `3.68.99.232` |
| `AWS_SSH_USER` | `ubuntu` |
| `APP_DOMAIN` | `steinstossen.aboimpinto.cloud-ip.cc` |
| `HOST_PORT` | `3008` |
| `APP_ROOT` | `/opt/steinstossen` |

Repository secret:

- `AWS_SSH_PRIVATE_KEY` — the complete contents of the AWS PEM private key.

The workflow uses its short-lived built-in `GITHUB_TOKEN` for GHCR. No long-lived
package token is required.

Never commit a PEM file. The local PEM path is needed only for the one-time Nginx and
server inspection. After the owner provides the path, store its contents as the
`AWS_SSH_PRIVATE_KEY` GitHub Actions secret and use the file directly only for manual
SSH.

## CI and CD workflows

- `.github/workflows/ci.yml`
  - installs Python and Node dependencies;
  - validates SQLite integrity and source coverage;
  - runs importer tests, typecheck, ESLint, and the Next.js production build;
  - builds and smoke-tests the final Docker image in German and English.
- `.github/workflows/cd.yml`
  - re-runs application checks;
  - publishes `latest` and the exact release tag to GHCR;
  - refuses to stop an unrelated container if port `3008` is occupied;
  - starts a localhost-only container;
  - verifies the health endpoint and both language roots.

## One-time AWS and Nginx setup

DNS already resolves to `3.68.99.232`.

After receiving the PEM path:

```bash
chmod 600 /path/to/aws-key.pem
ssh -i /path/to/aws-key.pem ubuntu@3.68.99.232
```

Before changing Nginx, inspect the host and save a snapshot:

```bash
sudo nginx -T > "/tmp/nginx-before-steinstossen-$(date +%Y%m%d-%H%M%S).conf"
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo ss -ltnp | grep ':3008 ' || true
ls -la /etc/nginx/sites-available /etc/nginx/sites-enabled
```

Do not edit another site's file. Install only the new HTTP bootstrap vhost:

```bash
scp -i /path/to/aws-key.pem \
  deploy/nginx/steinstossen.aboimpinto.cloud-ip.cc.http.conf \
  ubuntu@3.68.99.232:/tmp/steinstossen.http.conf

ssh -i /path/to/aws-key.pem ubuntu@3.68.99.232 <<'SSH'
set -e
sudo cp /tmp/steinstossen.http.conf \
  /etc/nginx/sites-available/steinstossen.aboimpinto.cloud-ip.cc
sudo ln -sfn \
  /etc/nginx/sites-available/steinstossen.aboimpinto.cloud-ip.cc \
  /etc/nginx/sites-enabled/steinstossen.aboimpinto.cloud-ip.cc
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certonly --nginx \
  --cert-name steinstossen.aboimpinto.cloud-ip.cc \
  -d steinstossen.aboimpinto.cloud-ip.cc
SSH
```

After the certificate exists, upload and install the final HTTPS vhost:

```bash
scp -i /path/to/aws-key.pem \
  deploy/nginx/steinstossen.aboimpinto.cloud-ip.cc.conf \
  ubuntu@3.68.99.232:/tmp/steinstossen.conf

ssh -i /path/to/aws-key.pem ubuntu@3.68.99.232 <<'SSH'
set -e
sudo cp /tmp/steinstossen.conf \
  /etc/nginx/sites-available/steinstossen.aboimpinto.cloud-ip.cc
sudo nginx -t
sudo systemctl reload nginx
SSH
```

If Certbot's Nginx plugin requires an active upstream, deploy the container first and
then issue the certificate. An upstream returning `502` does not affect the ACME
challenge when the plugin installs its challenge location, but the preferred sequence
is: configure GitHub secret, trigger CD, install HTTP vhost, issue certificate, install
HTTPS vhost.

## First release

Only after `AWS_SSH_PRIVATE_KEY` is configured and port `3008` is confirmed free:

```bash
git tag SteinStossen-v0.1.0
git push origin SteinStossen-v0.1.0
```

Then verify:

```bash
curl -fsS https://steinstossen.aboimpinto.cloud-ip.cc/api/health
curl -fsSI https://steinstossen.aboimpinto.cloud-ip.cc/de
curl -fsSI https://steinstossen.aboimpinto.cloud-ip.cc/en
```

## Rollback

Re-run the CD workflow for a known-good tag or push a new corrective release tag that
uses the known-good commit. Never replace or edit the SQLite file inside a running
container; release a reviewed image instead.

## Pending one-time actions

- receive the local AWS PEM path;
- store its contents in `AWS_SSH_PRIVATE_KEY`;
- verify host port `3008` is free;
- install the isolated Nginx vhost and certificate;
- create and push the first release tag;
- browser-verify the public German and English routes.
