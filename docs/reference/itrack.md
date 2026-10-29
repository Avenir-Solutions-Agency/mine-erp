# iTrack: vehicle telematics data sharing

Received 2026-10-29 from iTrack. iTrack created an external partner user for the ERP's API access.

- API documentation (Swagger): https://api.itrack.hu/rest/swagger-ui/index.html
- Shared fleets: Mészkő-Polgár Kft., RADICS BETON Kft., Mészkő Kereskedőház Kft.
- Credentials: username and password live in the password manager and later in the secret store (`ITRACK_USERNAME`, `ITRACK_PASSWORD`, not yet in `.env.example`). Never in this repo.
- The password must be changed at the first login on the iTrack desktop interface before the API is used.

Scope: iTrack is a phase-3 integration (PRD §07: trip planning, telematics). The prototype's Telematika screen stays simulated until then; read the Swagger before designing the client.
