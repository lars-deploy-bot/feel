# Alive Tagger Migration Checklist

Sites to update from `lovable-tagger` to `@webalive/alive-tagger`.

## Already Done

### Systemd-based sites in /srv/webalive/sites
- [x] alive.best
- [x] blank.alive.best
- [x] clash.alive.best
- [x] alivecustomers.alive.best
- [x] cafecomcacao.alive.best
- [x] checkcheck.alive.best
- [x] evermore.alive.best
- [x] evo.alive.best
- [x] johnvm.alive.best
- [x] larsvandeneeden.com
- [x] migrateapp.alive.best
- [x] mp4-to-mp3.alive.best
- [x] nami.alive.best
- [x] pokemon.alive.best
- [x] stekker.alive.best
- [x] taxi.alive.best
- [x] test-deploy-123.alive.best
- [x] testdeploy123.alive.best
- [x] topi.alive.best
- [x] webbb.alive.best
- [x] wfclientoutreach.alive.best

### Legacy PM2-based sites in /root/webalive/sites
- [x] barendbootsma.com
- [x] crazywebsite.nl
- [x] homable.nl
- [x] kranazilie.nl
- [x] riggedgpt.com
- [x] test-claude.com
- [x] wheelpickername.com

### Special sites
- [x] barend/customers.alive.best

### Templates
- [x] templates/site-template (already had aliveTagger)

## Steps for each site

1. Update `vite.config.ts`:
   - Change `import { componentTagger } from "lovable-tagger"` to `import { aliveTagger } from "@webalive/alive-tagger"`
   - Change `componentTagger()` to `aliveTagger()`

2. Copy alive-tagger package:
   ```bash
   mkdir -p /srv/webalive/sites/SITE/user/node_modules/@webalive
   cp -r /root/webalive/claude-bridge/packages/alive-tagger /srv/webalive/sites/SITE/user/node_modules/@webalive/
   ```

3. Fix permissions:
   ```bash
   chown -R site-SLUG:site-SLUG /srv/webalive/sites/SITE/user/node_modules/@webalive /srv/webalive/sites/SITE/user/vite.config.ts
   ```

4. Restart service:
   ```bash
   systemctl restart site@SLUG.service
   ```
