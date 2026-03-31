# Road Accident Data Hub

## Complete End-to-End Application Documentation

## 1. Executive Summary

The Road Accident Data Hub is a full-stack digital platform built to modernize the recording, review, analysis, and monitoring of fatal road accident investigations across Andhra Pradesh. It replaces fragmented, paper-heavy reporting with a structured, searchable, role-based system that supports district-level data capture, state-level oversight, geospatial visualization, analytics, and AI-assisted decision support.

The application is designed around the operational workflow followed by police and road safety stakeholders under the fatal road accident scientific investigation process. Instead of maintaining scattered paper files, manual registers, and delayed monthly compilations, the platform creates a centralized digital record for every accident submission and turns those records into actionable intelligence.

The strongest strategic value of the system is that it does not stop at digitization. It layers AI-assisted interpretation, hotspot discovery, trend analysis, and executive briefing support on top of operational data, making the platform a modern accident intelligence system rather than just a reporting form.

## 2. Problem Statement

### Business problem being solved

Fatal road accident investigations are traditionally handled through manual forms, paper records, physical movement of documents, and delayed district-level compilation. This creates major operational gaps:

- accident records are difficult to standardize across districts and police stations
- paper files are slow to consolidate for district or state review
- recurring causes and hotspot patterns are hard to identify manually
- signed and approved copies are difficult to track and retrieve
- executive officers cannot easily compare districts, police stations, corridors, or time periods
- decision-making is reactive because insights are generated after long manual effort
- historical records are not easily reusable for policy, enforcement, or engineering intervention

### Why paper-based systems underperform

Compared with manual paper workflows, paper records are:

- slower to create, transmit, verify, and review
- vulnerable to missing fields and inconsistent formatting
- difficult to search by FIR, district, date, road type, or police station
- weak for longitudinal analysis and trend monitoring
- unsuitable for live map-based hotspot visibility
- not easily shareable across departments
- poor inputs for AI, analytics, and predictive monitoring

This application solves those problems by converting each accident investigation into structured digital data that can be validated, stored, queried, visualized, exported, and analyzed with AI.

## 3. Vision of the Platform

The application is best understood as a digital road safety intelligence platform with five layers:

1. Data capture layer  
   District users submit structured accident investigation records.

2. Record management layer  
   Users and officers can retrieve, filter, export, and review submissions.

3. Geographic intelligence layer  
   Accident points are plotted on district and state maps with hotspot-style visualization.

4. Analytics layer  
   Dashboard views convert raw submissions into trends, comparisons, severity summaries, and compliance metrics.

5. AI layer  
   Gemini-based analysis generates case-level insights, batch analysis, and executive analytical summaries from live accident data.

## 4. Who Uses the System

### District users

District-level users log in using district credentials, create accident submissions, review their own submissions, upload signed copies, explore district maps, and run AI analysis on one or multiple submissions.

### DGP and admin users

Administrative users can access all submissions across districts, filter by time and geography, inspect records, export reports, and use the analytics dashboard for state-level review.

### ADGP users

ADGP users have a similar statewide oversight view focused on all submissions, list and map access, and navigation into deeper analytics.

## 5. End-to-End Workflow

### Step 1. User authentication

Users sign in from the authentication page by selecting a district or executive role such as `DGP` or `ADGP`, then entering a password. The backend issues a JWT token, and the frontend stores it locally for authenticated API access.

### Step 2. District-level data entry

A district user opens the accident submission form and captures:

- location details
- police station and mandal information
- FIR number
- road type
- accident date and time
- GPS coordinates
- victim counts
- vehicle details
- driver details
- causative analysis across driver, vehicle, and road engineering factors

The causative analysis section enforces structured yes/no capture, making the data suitable for reliable analytics and AI interpretation.

### Step 3. Submission storage

The backend validates and stores the submission in PostgreSQL. Complex sections such as vehicles, drivers, and causative factors are saved as JSONB, which makes the schema flexible while still allowing structured analysis.

### Step 4. District dashboard operations

After submission, district users can:

- review all their submissions
- search by FIR
- filter by SDPO and police station
- filter by date range
- filter by signed-copy status
- export reports as PDF or DOCX
- open map view for accident locations and hotspots
- run AI analysis on one record or a selected set of records

### Step 5. Signed-copy compliance tracking

Once the physical workflow is completed, users can upload signed copies in PDF, JPG, or PNG format. The platform tracks whether signed copies are uploaded or pending, turning a manual compliance step into a measurable digital status.

### Step 6. State-level review

Admin, DGP, and ADGP users can access statewide submissions through filtered dashboards. They can analyze volumes, casualties, districts covered, map concentrations, and individual records from a central command view.

### Step 7. AI and analytics consumption

The analytics module transforms submissions into operational intelligence. It generates:

- summary metrics
- monthly trends
- time-of-day patterns
- hotspot rankings
- road type risk analysis
- police station or district comparisons
- causative factor distributions
- data completeness and signed-copy compliance
- AI-generated narrative insights and recommendations

## 6. Key Features

### Core operational features

- role-based login for district and executive users
- structured accident investigation form
- jurisdiction-aware police station selection
- district dashboard with list and map views
- statewide admin and ADGP dashboards
- single record detail view
- signed-copy upload and compliance tracking
- PDF and DOCX report export
- secure file serving for uploaded documents

### Analytical features

- accident trend analysis by month
- fatalities and injuries summaries
- road type comparisons
- hotspot detection
- mandal and police-station analysis
- day-of-week and hour-of-day analysis
- severity distribution
- field completeness coverage
- signed-copy uploaded vs pending analysis

### Geographic features

- Google Maps integration
- district boundary overlays using GeoJSON
- statewide and district-specific map fitting
- marker-based accident plotting
- heat/intensity style visualization
- Leaflet fallback map when Google Maps is unavailable

### AI-first features

- Gemini-powered case analysis for individual accident submissions
- batch AI analysis across multiple selected submissions
- AI-assisted identification of recurring causes and patterns
- AI-generated preventive and infrastructure recommendations
- AI-generated executive analytical brief within the enhanced analytics dashboard
- AI-based narrative translation of charts into decision-ready insights

## 7. How the Application Outperforms Manual Paper Records

The platform materially outperforms manual systems in the following ways:

### Speed

- digital submission replaces repeated handwritten and retyped reporting
- officers can retrieve records instantly instead of locating files manually
- analytics are generated immediately from stored submissions

### Accuracy and consistency

- required field validation reduces incomplete records
- standardized yes/no causative capture improves comparability
- structured dropdowns reduce ambiguity in repeated data fields

### Traceability

- every submission is timestamped
- each record is tied to a user and district
- signed-copy status is visible and measurable

### Searchability

- users can filter by district, date, year, month, FIR, SDPO, police station, and compliance state
- state leadership can inspect accident records without manual consolidation

### Decision intelligence

- maps reveal concentration zones visually
- dashboards expose trends and recurring risks
- AI summarizes findings and recommendations far faster than manual review

### Scalability

- JSONB supports flexible schema growth
- dashboards scale from district to state views
- role-aware analytics support future expansion to more departments and workflows

## 8. Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui with Radix UI primitives
- React Router
- TanStack React Query
- Recharts

### Backend

- Node.js
- Express
- TypeScript
- JWT authentication
- bcrypt password hashing
- Helmet security middleware
- CORS configuration
- express-rate-limit
- Multer for signed-copy uploads

### Database

- PostgreSQL
- JSONB for structured nested accident data
- UUID-based primary keys
- indexed date, district, and user access patterns

### Mapping and geospatial

- Google Maps API
- district GeoJSON overlays
- Leaflet fallback support

### AI and modern intelligence services

- Google Gemini for case analysis and analytics summarization
- prompt-based contextual AI generation from live accident records
- batch AI analysis for pattern discovery across submissions

Note: the AI analysis routes are named with `rag` in the codebase, but the current implementation primarily sends structured submission data directly to Gemini rather than using a separate vector database retrieval layer.

### Deployment and tooling

- Docker
- Docker Compose
- TypeScript build pipeline
- Vitest
- Playwright
- ESLint

## 9. Architecture Overview

### Frontend architecture

The frontend is a single-page application that manages authentication state, route-level pages, API communication, interactive maps, report exports, and dashboard visualizations.

Main route-level pages:

- `Index`
- `AuthPage`
- `UserDashboard`
- `AdminDashboard`
- `AdgpDashboard`
- `EnhancedAnalytics`
- `AccidentForm`
- `SubmissionView`

### Backend architecture

The backend is an Express API that:

- authenticates users
- manages accident submissions
- exposes admin and analytics endpoints
- handles file uploads
- serves protected uploaded files
- calls Gemini services for AI features
- runs database migrations on startup

Main route modules:

- `auth`
- `submissions`
- `admin`
- `analytics`
- `enhanced-analytics`
- `rag-gemini`

### Data architecture

The main persistence model centers around:

- `users`
- `profiles`
- `user_roles`
- `accident_submissions`

The `accident_submissions` table is the heart of the platform. It combines scalar fields with JSONB fields to capture rich investigation details without forcing a brittle relational breakup for every sub-section.

## 10. Core Components and Modules

### Frontend components

- `GovHeader`  
  Shared government-branded header across pages.

- `AccidentMap` and `GoogleAccidentMap`  
  Render state and district accident maps with markers, district overlays, and heat-style visualization.

- `LeafletFallbackMap`  
  Backup mapping experience when Google Maps is not configured or available.

- `AccidentChat`  
  Conversational AI analysis panel for single or batch accident review.

- `CausativeSection`  
  Reusable component for structured yes/no causative factor capture.

- `exportReport.ts`  
  Generates PDF and DOCX outputs for accident reports.

### Backend modules

- `auth.ts`  
  JWT generation, verification, and auth middleware.

- `user-store.ts`  
  Resolves the active user table and supports username-based login matching.

- `db.ts`  
  PostgreSQL connection pool management.

- `migrate.ts`  
  Creates and updates the application schema.

- `routes/submissions.ts`  
  Submission creation, record retrieval, and signed-copy upload flow.

- `routes/enhanced-analytics.ts`  
  Generates advanced analytics datasets and AI summaries.

- `routes/rag-gemini.ts`  
  Handles AI-powered single and batch submission analysis.

## 11. AI Emphasis: Why This Is More Than a Dashboard

AI is one of the defining differentiators of this application.

### AI capability 1: Case-level accident reasoning

For an individual FIR submission, the system sends structured accident context to Gemini and asks for:

- root-cause analysis
- contributing factors
- preventive measures
- infrastructure recommendations
- legal and investigation suggestions

This reduces the time needed for officers to interpret a record and turns static data into decision support.

### AI capability 2: Batch intelligence across accidents

When multiple submissions are selected, the platform performs batch analysis to surface:

- recurring behavioural patterns
- repeated road environment issues
- policy and enforcement priorities
- area-wide preventive strategies

This is especially valuable for district review meetings, corridor safety discussions, and executive brief preparation.

### AI capability 3: Executive analytical brief

The enhanced analytics dashboard generates Gemini-backed narrative insights from computed metrics such as:

- total accidents
- deaths and injuries
- peak hour
- dangerous road types
- top causes
- hotspot locations
- top comparison units

This converts dashboard data into human-readable briefings for decision-makers who need conclusions and actions, not just charts.

### Why the AI layer matters strategically

The AI layer helps the application move from:

- record keeping to intelligence generation
- descriptive reporting to guided interpretation
- manual pattern recognition to assisted risk discovery
- retrospective review to more proactive safety planning

That AI emphasis makes the platform more future-ready for predictive policing, corridor-risk scoring, and interdepartmental road safety planning.

## 12. Scalability and Modern Engineering Strengths

The application already includes several strong foundations for scale:

- React + TypeScript frontend for maintainable growth
- modular Express route structure
- PostgreSQL with JSONB for flexible accident payloads
- indexed access paths for district, date, and user queries
- JWT-based stateless authentication
- protected role-aware access control
- reusable component architecture in the frontend
- Dockerized deployment path
- map abstraction with fallback support
- AI integration isolated behind route modules

### Why this architecture scales better than legacy systems

- new analytics views can be added without changing data-entry workflows
- more roles can be supported through the `user_roles` model
- JSONB fields allow expansion of investigation factors with less schema friction
- AI capabilities can be enhanced independently of the form and dashboard layers
- the same data model can support district, state, and future departmental reporting

## 12A. Point-by-Point Technology Comparison

This section is useful when the application needs to be presented as an advanced, modern platform rather than a basic web form.

| Area | Technology used in this application | Traditional or weaker alternative | Why our approach is stronger |
| --- | --- | --- | --- |
| Frontend architecture | React 18 + TypeScript | Static HTML pages or loosely structured JavaScript | Supports scalable UI growth, maintainability, strong typing, and reusable component-driven development |
| Build system | Vite | Older heavy bundlers or manual script setups | Faster startup, faster builds, better developer productivity, cleaner modern frontend workflow |
| UI system | Tailwind CSS + shadcn/ui + Radix | Custom unstructured CSS or inconsistent UI widgets | Faster UI development, accessible primitives, consistent design system, easier long-term maintenance |
| Routing | React Router | Page reload based navigation | Enables smooth single-page navigation and a more application-like user experience |
| State and server data | TanStack React Query | Manual fetch calls without caching strategy | Better request handling, cleaner async data flow, easier refresh and synchronization patterns |
| Charts and executive reporting | Recharts | Manual spreadsheets or static charts | Real-time, code-driven visual analytics from live data |
| Mapping | Google Maps with Leaflet fallback | Static district reports or non-interactive maps | Live accident visualization, hotspot awareness, district overlays, stronger decision support |
| Backend API | Express + TypeScript | Monolithic backend scripts or ad hoc endpoints | Cleaner modular API structure, easier scaling, better code organization |
| Authentication token model | JWT | Session-only or ad hoc auth handling | Stateless authentication, better API compatibility, easier deployment across environments |
| Password security | bcrypt hashing | Plain-text passwords or weak reversible storage | Industry-standard password protection with one-way hashing |
| Authorization | Role-based access using `user_roles` | Single shared login or all-users-same-access model | Fine-grained control for district users, admins, DGP, and ADGP roles |
| Database | PostgreSQL | Spreadsheet storage or flat-file records | Reliable relational storage, indexing, transactional integrity, scalable querying |
| Flexible data modeling | JSONB in PostgreSQL | Fixed rigid columns for every nested field or unstructured text blobs | Supports rich accident payloads while remaining queryable and scalable |
| File handling | Authenticated signed-copy uploads with validation | Manual physical storage or public file links | Secure digital compliance tracking and controlled record access |
| Security headers | Helmet | No browser hardening | Adds modern HTTP security protections |
| Abuse protection | Rate limiting on API and login | Unlimited login attempts and unrestricted access | Helps defend against brute-force and traffic abuse |
| CORS policy | Configured allowed origins | Open cross-origin access | Safer production deployment and better control over who can call the API |
| AI intelligence layer | Gemini-backed analysis and analytical summaries | Manual reading of every report or basic static dashboards | Faster pattern recognition, executive brief generation, and recommendation support |
| Deployment | Docker and Docker Compose | Manual machine-by-machine setup | Easier deployment, portability, environment consistency, faster onboarding |
| Production serving model | Express serves API and built frontend | Separate unmanaged runtime pieces | Simpler deployment topology and cleaner production packaging |
| Testing readiness | Vitest + Playwright configuration | No test structure | Better path toward quality assurance, regression prevention, and maintainable releases |

### Security technologies that make the application look advanced

#### bcrypt hashing

The application uses `bcrypt` for password hashing. This is a strong modern choice because:

- passwords are never stored in plain text
- hashing is one-way, so original passwords cannot simply be recovered
- bcrypt is deliberately slow compared to basic hashing, which makes brute-force attacks harder
- it is widely trusted in production-grade systems

This is much stronger than:

- plain-text password storage
- custom encryption approaches
- simple hashing methods like unsalted MD5 or SHA-only password storage

#### JWT authentication

The application uses JWT-based authentication for API access. This is a modern architecture choice because:

- it supports stateless backend authentication
- frontend and backend communication remains clean and API-friendly
- it scales better across modern deployment environments
- it works well for role-aware dashboards and protected routes

This is stronger than:

- passing user identity in plain requests
- weak cookie-only custom auth logic
- repeated credential checks on every request without tokenization

#### Role-based authorization

The platform uses role-based authorization with separate support for:

- district users
- admin users
- DGP users
- ADGP users

This is more advanced than a single shared-login model because it allows:

- restricted data visibility
- command-level access for senior officers
- district ownership with executive oversight
- future expansion to more departments or workflow stages

### Modern methodologies used in this application

#### Component-based frontend methodology

The frontend is built using reusable components instead of duplicated page-level code. This improves:

- maintainability
- UI consistency
- speed of enhancement
- long-term scalability

#### API-first modular backend design

The backend is organized around route modules such as auth, submissions, analytics, and AI. This is a modern service-oriented methodology because it separates responsibilities clearly and makes future enhancements easier.

#### Structured data capture methodology

Instead of writing free-form accident narratives only, the application captures structured attributes such as:

- district
- police station
- accident date and time
- vehicles
- drivers
- causative factors
- signed-copy compliance

This creates machine-readable data, which is the foundation for analytics and AI.

#### Hybrid relational plus semi-structured storage

Using PostgreSQL with JSONB is a modern methodology because it combines:

- relational reliability for core fields
- schema flexibility for nested accident data
- easier future evolution of the data model

#### Analytics-driven governance methodology

The application is built so operational records immediately feed dashboard intelligence. That is a modern public-sector digital methodology because it connects:

- field-level data capture
- supervisory review
- state-level monitoring
- evidence-backed decision-making

#### AI-augmented decision support methodology

The platform uses AI not as a cosmetic chatbot but as a decision-support layer. This is important to emphasize. The AI is applied to:

- interpret accident records
- summarize patterns across cases
- generate executive analytical narratives
- highlight preventive and infrastructure actions

That makes the application far more advanced than a normal MIS or digital form portal.

### Strong positioning lines for presentations

You can use the following statements directly in demos, reports, or review meetings:

- Our application uses `bcrypt` password hashing and JWT-based authentication, which aligns it with modern secure web application standards.
- The platform combines PostgreSQL relational reliability with JSONB flexibility, allowing us to scale accident intelligence without redesigning the entire schema each time.
- We are not just digitizing forms; we are creating structured, AI-ready, analytics-ready operational data.
- The system moves beyond data entry by providing role-based governance, geospatial hotspot visibility, executive dashboards, and Gemini-powered analytical intelligence.
- Compared to manual paper records, our platform is searchable, traceable, scalable, secure, and decision-oriented.
- This is an AI-enabled accident intelligence platform, not just a reporting portal.

## 13. Security and Governance Considerations

Current implementation includes:

- JWT-protected APIs
- role-aware access for admin, DGP, and ADGP workflows
- bcrypt password hashing
- rate limiting on login and API traffic
- Helmet-based HTTP security headers
- CORS restrictions
- authenticated access to uploaded signed-copy files
- file type and file size validation for uploads
- UUID validation for record access and upload routes

These are important because accident records are sensitive operational data and must not be exposed through unauthenticated file access or unrestricted APIs.

## 14. Deployment Model

The platform supports local and containerized deployment.

### Runtime model

- frontend is built with Vite
- backend runs as an Express server
- in production, the Express app serves the compiled frontend from `dist`
- PostgreSQL stores application data

### Containerization

Docker and Docker Compose support packaging of:

- the frontend build
- the backend server
- the PostgreSQL database

This simplifies reproducible deployment and improves portability across environments.

## 15. Recommended Positioning for Presentations and Reviews

When presenting this application, the strongest framing is:

`Road Accident Data Hub is an AI-enabled digital accident intelligence platform for Andhra Pradesh that replaces paper-based fatal accident investigation workflows with structured reporting, secure record management, geospatial monitoring, executive analytics, and Gemini-powered decision support.`

### High-value differentiators to highlight

- end-to-end digital replacement of paper investigation records
- statewide visibility with district-level ownership
- map-based hotspot and corridor awareness
- structured causative analysis suitable for policy and engineering action
- compliance tracking through signed-copy uploads
- AI-generated accident insights, pattern detection, and executive briefs
- scalable modern stack built for future road safety intelligence use cases

## 16. Future Enhancement Opportunities

The current architecture can naturally support future upgrades such as:

- predictive risk scoring for high-risk corridors
- FIR document parsing and AI-assisted field prefill
- multilingual AI summaries for field and executive use
- workflow stages for review, approval, and closure
- alerting for hotspot escalation or missing signed copies
- district performance benchmarking over rolling periods
- integration with transport, highways, and emergency response systems
- model-driven recommendation ranking for enforcement vs engineering intervention

## 17. Conclusion

The Road Accident Data Hub is not just a digital form system. It is a modern, scalable, AI-enhanced operational platform that captures accident investigation data at the source, turns it into structured institutional memory, and converts that data into maps, analytics, and recommendations for real-world road safety action.

Its biggest value lies in combining operational discipline with intelligent interpretation. That combination makes it meaningfully better than manual paper records and positions it as a strong foundation for the next generation of data-driven and AI-assisted road safety governance.
