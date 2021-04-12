# envcheck

Validate `.env` files against a schema before an app starts with a missing or
malformed setting. No dependencies.

    node bin/envcheck.js examples/app.env

So far this only parses the file and prints the variables as JSON.
