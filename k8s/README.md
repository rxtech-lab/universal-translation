# Kubernetes Deployment for Universal Translation

Deploys the Universal Translation app (Next.js) to Kubernetes.

## Architecture

- **ut-frontend** — Next.js app server (port 3000)

External services (not deployed here): Turso (DB).

## Files

| File | Purpose |
|------|---------|
| `namespace.yaml` | `universal-translation` namespace |
| `configmap.yaml` | Non-secret config |
| `secrets.yaml` | Secret template (placeholder values, not in kustomization) |
| `frontend-deployment.yaml` | Next.js deployment with health checks |
| `frontend-service.yaml` | ClusterIP for Next.js |
| `ingress.yaml` | NGINX ingress for `translate.rxlab.app` |
| `kustomization.yaml` | Kustomize orchestration |

## Prerequisites

1. Kubernetes cluster with `kubectl` access
2. NGINX Ingress Controller
3. cert-manager (for TLS)

## Setup

### 1. Populate Secrets

Edit `secrets.yaml` with real values, then apply:

```bash
kubectl apply -f k8s/secrets.yaml
```

### 2. Deploy

```bash
kubectl apply -k k8s/
```

### 3. Verify

```bash
kubectl get pods -n universal-translation
kubectl get services -n universal-translation
kubectl get ingress -n universal-translation
```

## Health Checks

| Component | Endpoint | Port |
|-----------|----------|------|
| Frontend | `/api/health` | 3000 |

## CI/CD

The GitHub Actions workflow (`release.yml`) automatically:
1. Builds Docker images on every push (test only, no push)
2. On release: pushes images to GHCR and deploys to K8s

Required GitHub Secret: `K8S_CONFIG_FILE_B64` (base64-encoded kubeconfig)
