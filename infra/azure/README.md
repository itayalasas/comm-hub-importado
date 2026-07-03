# Azure Container Apps Deployment

This repository is configured to build the Vite frontend into a Docker image and deploy it to Azure Container Apps on every push to `main`.

## Files added
- `Dockerfile` - multi-stage build for the frontend and static site delivery with Nginx.
- `.dockerignore` - reduces build context and excludes local files.
- `.github/workflows/azure-container-apps.yml` - GitHub Actions workflow to build, push, and deploy.
- `nginx.conf` - Nginx configuration for a client-side SPA.

## Required GitHub secrets
Set these repository secrets before using the workflow:

- `AZURE_CREDENTIALS` - Azure service principal JSON from `az ad sp create-for-rbac --name "github-action-comm-hub" --role contributor --scopes /subscriptions/<id>/resourceGroups/<rg> --sdk-auth`
- `AZURE_RESOURCE_GROUP` - Azure resource group name
- `AZURE_CONTAINERAPPS_ENVIRONMENT` - Azure Container Apps environment name
- `AZURE_CONTAINER_APP_NAME` - Container App name
- `ACR_NAME` - Azure Container Registry name
- `ACR_LOGIN_SERVER` - ACR login server (example: `myregistry.azurecr.io`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_API_KEY`
- `VITE_AUTH_APP_ID`
- `VITE_AUTH_URL`
- `VITE_REDIRECT_URI`

> Nota: esta app frontend no debe depender de un `.env` en despliegue.
> Las variables se cargan dinámicamente en runtime desde la API `/get-env` definida en `src/lib/config.ts`.

## Deployment flow
1. Push to `main` or run the workflow manually.
2. GitHub Actions logs into Azure and ACR.
3. The Docker image is built using Vite and the frontend environment variables.
4. The image is pushed to ACR.
5. The Container App is created if missing, or updated if already present.

## Notes
- This workflow assumes the Container Apps environment already exists.
- If you need a new environment, create it with `az containerapp env create`.
- If your app needs runtime secrets, add them as Container App secrets or modify the workflow to pass `--secrets`/`--env-vars` to `az containerapp update`.
