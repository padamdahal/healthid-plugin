# Health ID Connect — DHIS2 Plugin Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Datastore Configuration](#datastore-configuration)
5. [DHIS2 Routes Configuration](#dhis2-routes-configuration)
6. [Tracker Program Setup](#tracker-program-setup)
7. [Plugin Installation](#plugin-installation)
8. [Field Mapping Reference](#field-mapping-reference)
9. [Authentication Options](#authentication-options)
10. [User Guide](#user-guide)
11. [Troubleshooting](#troubleshooting)

---

## Overview

**Health ID Connect** is a DHIS2 Tracker form field plugin that allows users to search for a patient using a defined identifiers (e.g., Health ID, National ID etc.) and automatically populate Tracker enrollment fields from a FHIR-compliant external system.

### What it does

- Displays configurable radio buttons for available identifier types
- Accepts an ID number input from the user
- Queries a FHIR API endpoint (via DHIS2 Routes or a direct URL)
- Extracts and maps patient data (name, gender, birthdate, address, contacts, identifiers) into Tracker enrollment fields

---

## Architecture

```
DHIS2 Tracker Form
        │
        ▼
Health ID Connect Plugin (React/TSX)
        │
        ├── Reads config from DHIS2 Datastore
        │       └── /api/dataStore/healthidconnect/config
        │
        └── Queries patient data via:
                ├── Option A: DHIS2 Routes API  (/api/routes/{routeId}/run)
                └── Option B: Direct FHIR URL   (custom URL + auth header)
```

---

## Prerequisites

- DHIS2 version 2.38 or later
- A FHIR R4-compliant external system exposing a `Person` resource search endpoint
- DHIS2 administrator access (for Datastore and Routes configuration)
- The plugin app deployed and accessible in DHIS2

---

## Datastore Configuration

The plugin reads its configuration from the DHIS2 Datastore under the namespace `healthidconnect` and key `config`.

### Endpoint

```
POST/PUT /api/dataStore/healthidconnect/config
```

### Configuration Schema

```json
{
  "routeId": "string | null",
  "customUrl": {
    "authHeader": "string",
    "fhirBaseUrl": "string"
  },
  "healthIdSystemKey": "string",
  "identifiers": {
    "<key>": {
      "label": "string",
      "system": "string (URI)"
    }
  }
}
```

### Field Descriptions

| Field | Required | Description |
|---|---|---|
| `routeId` | Conditional | DHIS2 Route ID for proxying the FHIR request. Takes priority over `customUrl`. Set to `null` if not used. |
| `customUrl.authHeader` | Conditional | Full `Authorization` header value (e.g., `Basic dXNlcjpwYXNz`). Used only if `routeId` is absent. |
| `customUrl.fhirBaseUrl` | Conditional | Base URL of the FHIR Person search endpoint. Used only if `routeId` is absent. |
| `healthIdSystemKey` | Required | The key within `identifiers` that corresponds to the Health ID system. Used to map the Health ID value to the `healthId` Tracker field. |
| `identifiers` | Required | A map of identifier types. Each key is an internal identifier key, and the value contains a display `label` and the FHIR `system` URI. |

### Example Configuration (using DHIS2 Routes)

```json
{
  "routeId": "abc123routeid",
  "healthIdSystemKey": "healthid",
  "identifiers": {
    "healthid": {
      "label": "Health ID",
      "system": "https://fhir.hmis.gov.np/NamingSystem/health-id"
    },
    "nationalid": {
      "label": "National ID",
      "system": "http://moh.gov.np/national-id"
    }
  }
}
```

### Example Configuration (using Direct URL)

```json
{
  "routeId": null,
  "customUrl": {
    "authHeader": "Basic dXNlcjpwYXNzd29yZA==",
    "fhirBaseUrl": "https://api.somedomain.com/fhir/Person"
  },
  "healthIdSystemKey": "healthid",
  "identifiers": {
    "healthid": {
      "label": "Health ID",
      "system": "https://fhir.hmis.gov.np/NamingSystem/health-id"
    },
    "nationalid": {
      "label": "National ID",
      "system": "http://moh.gov.np/national-id"
    }
  }
}
```

### Setting the Configuration via API

Use the DHIS2 API to create or update the datastore config:

```bash
# Create
curl -X POST \
  "https://your-dhis2-instance/api/dataStore/healthidconnect/config" \
  -H "Content-Type: application/json" \
  -u admin:district \
  -d '{...your config json...}'

# Update
curl -X PUT \
  "https://your-dhis2-instance/api/dataStore/healthidconnect/config" \
  -H "Content-Type: application/json" \
  -u admin:district \
  -d '{...your config json...}'
```

---

## DHIS2 Routes Configuration

If you are using `routeId`, you must first create a DHIS2 Route that proxies requests to the external FHIR server.

### Create a Route

```bash
curl -X POST \
  "https://your-dhis2-instance/api/routes" \
  -H "Content-Type: application/json" \
  -u admin:district \
  -d '{
    "name": "Health ID FHIR Route",
    "code": "healthid-fhir",
    "url": "https://api.somedomain.com/fhir/Person",
    "auth": {
      "type": "http",
      "username": "your-username",
      "password": "your-password"
    }
  }'
```

The `id` returned in the response is the value to use as `routeId` in your Datastore config.

### How the Route is Called

The plugin appends an `identifier` query parameter to the route run endpoint:

```
/api/routes/{routeId}/run?identifier={system}|{enteredId}
```

Example:

```
/api/routes/abc123routeid/run?identifier=http://moh.gov.np/national-id|1234567890
```

---

## Tracker Program Setup

### Step 1: Create the Tracker Program

Set up a Tracker program in DHIS2 with enrollment attributes that match the field IDs expected by the plugin.

### Step 2: Required Tracked Entity Attributes

The plugin uses `setFieldValue` with the following `fieldId` values. These must match the **field IDs** assigned to the attributes in your Tracker program configuration:

| Field ID | Description | FHIR Source |
|---|---|---|
| `healthId` | Health ID number | `identifier[system=healthIdSystem].value` |
| `firstName` | First name | `name[use=official].given[0]` |
| `middleName` | Middle name | `name[use=official].given[1]` |
| `lastName` | Family name | `name[use=official].family` |
| `birthDate` | Date of birth | `birthDate` |
| `gender` | Gender | `gender` |
| `address` | Full address | `address[0]` (concatenated) |
| `phone` | Phone number | `telecom[system=phone].value` |
| `email` | Email address | `telecom[system=email].value` |

> **Note:** The field IDs above are the identifiers used in the plugin code. Ensure your Tracker program's attribute field IDs match exactly.

### Step 3: Assign the Plugin to a Form Field

1. Navigate to **Maintenance → Programs → Your Program → Program Stages**
2. Select the relevant Program Stage
3. In the **Data Elements** section, find the field where you want to embed the plugin
4. Under **Plugin**, assign the deployed Health ID Connect plugin
5. Save

---

## Plugin Installation

### Deploying to DHIS2

Upload the built plugin to your DHIS2 instance via the **App Management** module or the API:

```bash
curl -X POST \
  "https://your-dhis2-instance/api/apps" \
  -H "Content-Type: application/zip" \
  -u admin:district \
  --data-binary @healthid-connect-plugin.zip
```

---

## Field Mapping Reference

### FHIR Person → DHIS2 Field Mapping

The plugin extracts a FHIR `Bundle` of type `searchset` containing `Person` resources. It uses the first entry in the bundle.

```
FHIR Bundle (searchset)
└── entry[0].resource (Person)
    ├── name[use=official]
    │   ├── given[0]     → firstName (first word)
    │   ├── given[1]     → middleName (second word)
    │   └── family       → lastName
    ├── birthDate        → birthDate
    ├── gender           → gender
    ├── telecom
    │   ├── [system=phone].value  → phone
    │   └── [system=email].value  → email
    ├── address[0]
    │   └── line + city + state + postalCode → address (comma-separated)
    └── identifier[]
        └── [system=healthIdSystem].value → healthId
```

### Identifier System Matching

The plugin matches identifiers from the FHIR response using the `system` URI defined in the Datastore config. For example:

```
config.identifiers.healthid.system = "https://fhir.hmis.gov.np/NamingSystem/health-id"
```

The plugin looks up:

```
person.identifier.find(id => id.system === "https://fhir.hmis.gov.np/NamingSystem/health-id").value
```

---

## Authentication Options

### Option A: DHIS2 Routes (Recommended)

Authentication is handled by DHIS2 internally through the Route configuration. No credentials are exposed to the frontend. This is the preferred and more secure approach.

### Option B: Direct URL with Auth Header

Set `customUrl.authHeader` in the Datastore config to the full `Authorization` header value.

**Basic Auth** (encode `username:password` in base64):

```bash
echo -n "username:password" | base64
# Output: dXNlcm5hbWU6cGFzc3dvcmQ=
```

Set in config:
```json
"authHeader": "Basic dXNlcm5hbWU6cGFzc3dvcmQ="
```

**Bearer Token:**
```json
"authHeader": "Bearer eyJhbGciOiJSUzI1NiJ9..."
```

> **Security Note:** Storing credentials in the Datastore makes them accessible to DHIS2 administrators. Always prefer Option A (DHIS2 Routes) for production environments.

---

## User Guide

### How to Search for a Patient

The plugin appears as an embedded panel inside the Tracker enrollment form, styled with a green border.

**Step 1:** Read the instruction text:
> *"Search for health ID with available ID numbers below."*

**Step 2:** Select the type of ID you have using the radio buttons (e.g., Health ID, National ID).

**Step 3:** Enter the patient's ID number in the text input field.

**Step 4:** Click **खोज्नुहोस** (Search).

**Step 5:** Wait for the result message:
- **"Working..."** — the search is in progress
- **"Match found, data loaded..."** — patient data has been populated in the form fields
- **"No match found"** — no patient was found; form fields have been cleared
- **"Please select ID type."** — you must select a radio button first
- **"Please enter a valid ID number of selected type."** — the text field is empty

**Step 6:** Review the auto-populated fields and complete any remaining required fields before submitting the enrollment.

### Status Messages

| Message | Meaning |
|---|---|
| Loading... | Plugin is loading configuration |
| Working... | Search is in progress |
| Match found, data loaded... | Patient found and fields populated |
| No match found | No patient matched the given ID |
| Please select ID type. | No identifier type radio button selected |
| Please enter a valid ID number of selected type. | Text input is empty |
| Either routesId or fhirBaseUrl should exist. | Datastore configuration is incomplete |
| Health ID system is not configured... | `healthIdSystemKey` is missing from config |
| Failed to fetch config... | Could not load Datastore configuration |

---

## Troubleshooting

### Plugin shows "Failed to fetch config..."

- Verify the Datastore entry exists at `/api/dataStore/healthidconnect/config`
- Check that the user has read access to the `healthidconnect` Datastore namespace
- Confirm the DHIS2 instance base path is correctly detected (especially if deployed under a sub-path like `/ephc`)

### Plugin shows "Health ID system is not configured..."

- Check that `healthIdSystemKey` is set in the Datastore config
- Ensure the value of `healthIdSystemKey` matches a key in `identifiers`

### Search returns "No match found" unexpectedly

- Verify the FHIR endpoint returns a valid Bundle with `total > 0` for known IDs
- Check that the `system` URI in the config exactly matches the system used in the FHIR server
- Test the FHIR endpoint directly:
  ```bash
  curl "https://api.somedomain.com/fhir/Person?identifier=http://moh.gov.np/national-id|1234567890"
  ```

### Fields are not being populated after a successful search

- Confirm the `fieldId` values in the plugin match the actual field IDs in the Tracker program
- Check browser console for errors from `setFieldValue`
- Ensure the FHIR Person resource contains the expected fields (`name`, `birthDate`, `gender`, etc.)

### Plugin does not load / blank panel

- Check browser console for JavaScript errors
- Ensure the plugin is correctly installed and assigned to the program stage field
- Verify the DHIS2 version is 2.38 or later

### Deployed under a sub-path (e.g., `/ephc`)

The plugin automatically detects the base path from `window.location.pathname`. No additional configuration is needed. If the API calls fail, verify the path detection by checking:

```javascript
const pathname = window.location.pathname
const basePath = '/' + pathname.split('/').filter(Boolean)[0]
// Should output: "/ephc"
```

---

*Documentation generated for Health ID Connect Plugin v1.0*

{
    "routeId": "healthid",
    "customUrl": {
        "authHeader": "Basic YW1ha29tYXlhOk4zcEAxIUFwcA==",
        "fhirBaseUrl": "https://api.amakomaya.com/Person"
    },
    "identifiers": {
        "healthid": {
            "label": "Health ID",
            "system": "http://www.edifecs.com/personid",
            "baseUrl": "https://api.amakomaya.com/Person",
            "routeId": "healthid",
            "authHeader": "Basic YW1ha29tY123vcfd3IUFwcA==",
            "contentType": "fhir",
            "queryString": "identifier={system}|{id}"
        },
        "systemid": {
            "label": "System ID",
            "system": "",
            "baseUrl": "https://ocl.hmis.gov.np/ephc/api/tracker/trackedEntities",
            "routeId": "",
            "authHeader": "",
            "contentType": "json",
            "queryString": "filter=q3NpuWzGvso:eq:{id}&program=kvottqqHM1j&orgUnitMode=ACCESSIBLE"
        },
        "nationalid": {
            "label": "National ID",
            "system": "http://moha.gov.np/identifiers/national-id",
            "baseUrl": "",
            "routeId": "healthid",
            "authHeader": "",
            "contentType": "json",
            "queryString": "identifier={system}|{id}"
        }
    },
    "healthIdSystemKey": "healthid"
}