```sh
bun i && bun run build
```

Drop `.output/chrome-mv3` folder to `chrome://extensions`

<details>
  <summary>Note</summary>

Out of the box, this extension operates in simple mode.

To type in sites like Google Docs, setup worker mode by running:

```sh
bun run host/install.ts <extension-id>
```

</details>
