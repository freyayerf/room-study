# Security and privacy

Room Study is a static, local-first app. It does not upload plans or require credentials. Browser storage and exported plan files may contain sensitive home-layout information; users control their own backups. Static hosting providers receive normal access logs.

For a security issue, use GitHub's **Security → Report a vulnerability** if available. Otherwise open a minimal issue asking for a private reporting channel without posting exploit details or personal data. Do not attach tokens, credentials or real home plans.

The current 1.x release line receives fixes. Imported JSON is validated and rendered names are escaped. Files are limited to 25 MB, plans to 100 furniture pieces and libraries to 1000 entries. Unknown metadata is not retained. Imported data never runs as code.

Maintainers should reproduce reports using synthetic plans, add regression coverage and publish a patch release. Release workflows use scoped built-in GitHub tokens; deployment does not need personal tokens. No analytics or external fonts are included in the offline build.
