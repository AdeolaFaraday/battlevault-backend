# Infrastructure Setup: Dev vs. Prod & Disaster Recovery

Congratulations on reaching the MVP phase for BattleVault! As you transition towards a public release, separating your environments (Development and Production) is crucial for stability, security, and developer productivity. 

This guide outlines how to separate your infrastructure across MongoDB, Google Cloud Run (Backend), and Vercel (Frontend), followed by a disaster recovery strategy.

---

## 1. Environment Separation Strategy

The core principle is to have completely isolated resources for `development` and `production`. They should share no data, no API keys, and no compute resources.

### A. Environment Variables (`.env`)

You will maintain distinct environment configurations.

**Local Development (`.env`)**
```env
ENV=development
NODE_ENV=development
DB_CLOUD_CONNECTION=mongodb+srv://dev-user:dev-pass@cluster-dev.mongodb.net/battlevault-dev
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:8080
# ... other dev-specific keys (e.g., test payment provider keys)
```

**Production (Managed in Cloud Run / Vercel secrets)**
```env
ENV=production
NODE_ENV=production
DB_CLOUD_CONNECTION=mongodb+srv://prod-user:prod-pass@cluster-prod.mongodb.net/battlevault-prod
CLIENT_URL=https://battlevault.com
SERVER_URL=https://api.battlevault.com
# ... production keys
```

---

## 2. Infrastructure Setup Guide

### A. Database (MongoDB Atlas)

It is highly recommended to use separate **Clusters** for Dev and Prod to prevent accidental data corruption or performance interference. 

***What is a Cluster?***
In MongoDB Atlas, a *cluster* is a group of cloud servers that store your data and ensure it is always available (even if one server in the cluster fails). You can think of a cluster as the physical (or virtual) house for your data, with its own dedicated CPU, memory, and storage resources.

***Tight Budget Alternative (Logical Databases):***
If running two separate dedicated clusters is too expensive, you can use *separate logical databases within a single dedicated cluster*. A "logical database" is just a named collection of data inside the cluster (e.g., one named `battlevault-dev` and one named `battlevault-prod`). While this doesn't isolate CPU/memory performance (a spike in dev could affect prod), it does isolate the data itself securely, provided you configure database users correctly.

1.  **Create Production Cluster:**
    *   In MongoDB Atlas, create a new cluster (e.g., `Cluster-Prod`). Recommended: M10 tier or higher for production workloads.
2.  **Create Development Cluster:**
    *   Create a separate cluster (e.g., `Cluster-Dev`). An M0 (Free Tier) or M2/M5 is usually sufficient for development.
3.  **Database Users & Access:**
    *   Create distinct database users with strong, unique passwords for both environments.
    *   **Network Access:**
        *   **Prod:** Restrict IP access to only your Google Cloud Run outbound IP addresses (or use VPC Peering for enhanced security).
        *   **Dev:** Allow access from your local IP and any CI/CD pipelines.

### B. Backend Hosting (Google Cloud Run)

You will deploy two separate Cloud Run services within your Google Cloud Project.

1.  **Deploying the Backend Service:**
    *   **Prod Service:** Name it `battlevault-api-prod`.
    *   **Dev Service:** Name it `battlevault-api-dev`.
2.  **Configuring Environment Variables:**
    *   In the Google Cloud Console, navigate to your Cloud Run services.
    *   Under **Edit & Deploy New Revision** -> **Variables & Secrets**, add the respective production or development environment variables.
    *   *Security Best Practice:* Use **Google Secret Manager** for sensitive variables like `DB_CLOUD_CONNECTION`, `JWT_SECRET`, and API keys, rather than plain text variables.
3.  **CI/CD Pipeline (GitHub Actions / Cloud Build):**
    *   Configure your pipeline to trigger deployments based on branches:
        *   Commits to `main` branch -> Deploys to `battlevault-api-prod`.
        *   Commits to `develop` branch -> Deploys to `battlevault-api-dev`.

### C. Frontend Hosting (Vercel)

Vercel makes environment separation very straightforward.

1.  **Link Repository:** Connect your frontend repository to a single Vercel project.
2.  **Domains:**
    *   **Production:** Map your primary domain (e.g., `battlevault.com`) to the `main` branch.
    *   **Preview/Dev:** Vercel automatically generates preview URLs for every pull request and branch. You can also map a specific branch (e.g., `develop`) to a required subdomain like `dev.battlevault.com`.
3.  **Environment Variables in Vercel:**
    *   Go to **Project Settings** -> **Environment Variables**.
    *   Add your variables and select the target environments:
        *   Select **Production** for production values (e.g., pointing to `https://api.battlevault.com`).
        *   Select **Preview** and **Development** for dev values (e.g., pointing to `https://battlevault-api-dev-xyz.run.app`).

---

## 3. Disaster Recovery & Data Backup Strategy

A robust disaster recovery (DR) plan ensures your game data and user accounts are safe in case of accidental deletion, corruption, or regional outages.

### A. MongoDB Automated Backups (Primary Defense)

If you are using MongoDB Atlas (M10 tier or higher), leverage their built-in continuous backup features.

1.  **Enable Point-in-Time Recovery (PITR):**
    *   In the Atlas UI, go to your Production Cluster -> **Backup**.
    *   Ensure **Cloud Backups** are enabled.
    *   Enable continuous cloud backups with **Point-in-Time Recovery**. This allows you to restore your database to *any exact minute* within your retention window (usually the last 7 or 35 days).
2.  **Snapshot Scheduling:**
    *   Atlas automatically takes cluster snapshots. Verify the schedule fits your needs (e.g., hourly, daily).
3.  **Cross-Region Replication (High Availability):**
    *   For maximizing uptime, deploy your production Atlas cluster as a Replica Set across multiple Google Cloud regions (e.g., eu-west1, eu-west2). If one region goes down, the database automatically fails over.

### B. Logical Backups (Secondary Defense / Off-Site)

Relying solely on Atlas is good, but having an independent snapshot stored elsewhere (like AWS S3 or Google Cloud Storage) is the gold standard for DR.

1.  **Scripting with `mongodump`:**
    *   Create a script that uses the `mongodump` utility to export the entire database format.
    ```bash
    mongodump --uri="mongodb+srv://prod-user:prod-pass@cluster-prod.mongodb.net/battlevault-prod" --archive=battlevault-backup-$(date +%F).archive --gzip
    ```
2.  **Automated Execution (Cron Job / Cloud Scheduler):**
    *   Do not run this manually. Set up a **Google Cloud Scheduler** job to trigger a Cloud Function or Cloud Run task daily at a low-traffic time (e.g., 3:00 AM).
3.  **Off-site Storage:**
    *   Have the scheduled task upload the `.archive.gz` file securely to a dedicated **Google Cloud Storage (GCS) bucket** (e.g., `battlevault-db-backups`).
    *   **Lifecycle Rules:** Configure the GCS bucket to automatically delete backups older than 30 or 60 days to manage costs.

### C. Testing the Recovery Process

A backup is useless if you don't know how to restore it.

1.  **Scheduled Drills:** Every 3-6 months, perform a test restore.
2.  **Restore Procedure:**
    *   Spin up a temporary isolate cluster in Atlas or a local MongoDB instance.
    *   Use `mongorestore` to populate the temporary database from your latest GCS backup archive.
    *   Verify the data integrity (e.g., check user counts, ensure recent transactions exist).

### D. Code & Asset Backups

*   **Source Code:** Handled by Git/GitHub. Ensure branch protection rules are on `main`.
*   **User Uploads/Assets:** If users upload images or you have dynamic game assets stored in an S3/GCS bucket, ensure that bucket has **Versioning enabled**. This prevents accidental permanent overwrites or deletions of files.
