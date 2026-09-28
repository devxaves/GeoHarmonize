# Admin Feature Migration Guide & Instructions

This package contains the complete file structure and implementation code required to replicate the **Admin Console** feature (including **Demarcate Parcel**, **Register Corridor**, **Federated Adapters**, and the **Interactive Map Polygon Tool**) into any Next.js (App Router) project.

---

## 📂 File Mapping & Directory Structure

To integrate this feature into your target project, copy the files directly into your project matching the paths below:

```text
migration/
├── README.md                              <-- This instruction guide
├── app/
│   ├── admin/
│   │   └── page.tsx                       <-- Core Admin Console page with 3 section tabs
│   └── api/
│       ├── parcels/route.ts               <-- POST: Create parcel with GeoJSON & ULPIN
│       ├── projects/route.ts              <-- GET/POST: Fetch corridors list & Create corridor
│       ├── risk/compute/route.ts          # POST: Instant risk calculation engine API
│       └── mock/
│           ├── [adapter]/route.ts         # GET: Federated Mock Adapters (DILRMP, LACRRIS, PFMS)
│           └── logs/route.ts              # GET: Adapter API Execution Logs
└── components/
    └── map/
        └── MiniMapPolygon.tsx             <-- Custom MapLibre interactive polygon drawing & Nominatim search component
```

---

## ⚡ Integration Instructions for the Target Project Agent

1. **Copy Files**:
   - Copy `app/admin/page.tsx` into your target project's `app/admin/page.tsx`.
   - Copy `components/map/MiniMapPolygon.tsx` into `components/map/MiniMapPolygon.tsx`.
   - Copy all files from `app/api/` into the target project's `app/api/` directory.

2. **Required Dependencies**:
   Install the necessary npm dependencies in the target project:
   ```bash
   npm install maplibre-gl swr lucide-react @types/geojson
   ```

3. **MapLibre CSS Requirement**:
   Ensure `maplibre-gl/dist/maplibre-gl.css` is imported in your target app layout (e.g., `app/layout.tsx` or global CSS file):
   ```tsx
   import "maplibre-gl/dist/maplibre-gl.css";
   ```

4. **Database & Schema Requirements**:
   - The `/api/parcels` and `/api/projects` endpoints expect PostgreSQL database helper functions or table access for `parcels`, `projects`, and `risk_assessments`.
   - If using a different database layer in the target project, adjust the queries inside `app/api/parcels/route.ts` and `app/api/projects/route.ts` accordingly.
