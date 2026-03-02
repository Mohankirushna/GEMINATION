# Firebase Service Account Key Setup

## Steps to Download Firebase Service Account Key

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: **gemination-bbecc**

2. **Open Project Settings**
   - Click the gear icon (⚙️) next to "Project Overview" in the left sidebar
   - Or go directly to: https://console.firebase.google.com/project/gemination-bbecc/settings/general

3. **Go to Service Accounts Tab**
   - Click on the "Service accounts" tab at the top

4. **Generate New Private Key**
   - Scroll down to "Firebase Admin SDK" section
   - Click **"Generate new private key"** button
   - A JSON file will download automatically (e.g., `gemination-bbecc-firebase-adminsdk-xxxxx.json`)

5. **Save the Key File**
   - Rename the downloaded file to: `service-account-key.json`
   - Move it to: `C:\Users\Shyam\Desktop\suraksha-flow\backend\service-account-key.json`

6. **Verify the Setup**
   - The file should be at: `backend/service-account-key.json`
   - This file contains sensitive credentials - **DO NOT COMMIT TO GIT**
   - The `.gitignore` already excludes this file

## Example Service Account Key Structure

Your `service-account-key.json` should look like this:

```json
{
  "type": "service_account",
  "project_id": "gemination-bbecc",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@gemination-bbecc.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## Security Notes

- ⚠️ **Never share** your service account key publicly
- ⚠️ **Never commit** this file to version control
- ✅ The file is already in `.gitignore`
- ✅ Only authorized developers should have access
