# SendCraft SDKs

Paquetes listos para publicar y consumir desde Node.js, .NET y Java.

## Estructura

- `sdk/openapi/sendcraft.openapi.json` contiene la especificacion OpenAPI 3.1
- `sdk/sendcraft-node-sdk` contiene el cliente para Node.js
- `sdk/SendCraft.Sdk` contiene el cliente para .NET
- `sdk/sendcraft-java-sdk` contiene el cliente para Java

## Publicacion

- Node: `npm publish` desde `sdk/sendcraft-node-sdk`
- .NET: `dotnet pack` y luego `dotnet nuget push` desde `sdk/SendCraft.Sdk`
- Java: `mvn deploy` o `mvn install` desde `sdk/sendcraft-java-sdk`

## Catalogo publico

7 grupos oficiales, 16 endpoints publicos.
- `npm run sdk:status` lista el catalogo y puede probar una URL con `--base-url=...` o `SDK_BASE_URL`.

## Regeneracion

Ejecuta `node tools/generate-sdk-artifacts.mjs` para volver a materializar los paquetes con base URL https://api.sendcraft.net.
