# Coachful Architecture

This document provides visual diagrams of the Coachful codebase architecture using Mermaid.js.

## System Architecture Overview

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Browser["Browser"]
        Mobile["Mobile (PWA)"]
    end

    subgraph NextJS["Next.js App Router"]
        Middleware["proxy.ts<br/>(Multi-tenant Middleware)"]

        subgraph Pages["Pages (src/app/)"]
            Auth["Auth Routes<br/>sign-in, signup, sso-callback"]
            User["User Features<br/>feed, goals, habits, tasks"]
            Coach["Coach Dashboard<br/>coach/, admin/"]
            Program["Programs<br/>program/, discover/"]
            Squad["Squads<br/>squad/, chat/, call/"]
            Onboard["Onboarding<br/>onboarding/"]
        end

        subgraph API["API Routes (src/app/api/)"]
            AuthAPI["auth/"]
            ChatAPI["chat/"]
            BillingAPI["billing/"]
            AIAPI["ai/"]
            SchedulingAPI["scheduling/"]
            DiscoverAPI["discover/"]
        end
    end

    subgraph Providers["React Context Providers"]
        direction TB
        ClerkTheme["ClerkThemeProvider"]
        Demo["DemoModeProvider"]
        DemoSession["DemoSessionProvider"]
        Theme["ThemeProvider"]
        SWR["SWRProvider"]
        Branding["BrandingProvider"]
        SquadCtx["SquadProvider"]
        OrgCtx["OrganizationProvider"]
        StreamChat["StreamChatProvider"]
        StreamVideo["StreamVideoProvider"]
        ChatSheet["ChatSheetProvider"]
    end

    subgraph External["External Services"]
        Clerk["Clerk<br/>(Auth & Organizations)"]
        Firebase["Firebase<br/>(Firestore + Storage)"]
        Stream["Stream<br/>(Chat + Video)"]
        Stripe["Stripe<br/>(Payments + Connect)"]
        Anthropic["Anthropic Claude<br/>(AI Generation)"]
        Resend["Resend<br/>(Email)"]
        Vercel["Vercel Edge Config<br/>(Fast Tenant Lookup)"]
    end

    Browser --> Middleware
    Mobile --> Middleware

    Middleware --> Pages
    Middleware --> API

    Pages --> Providers

    API --> Clerk
    API --> Firebase
    API --> Stream
    API --> Stripe
    API --> Anthropic
    API --> Resend

    Middleware --> Vercel
    Providers --> Clerk
    Providers --> Stream
```

## Provider Hierarchy

The React context providers are nested in this specific order in `src/app/layout.tsx`:

```mermaid
flowchart TB
    subgraph Root["Root Layout Provider Hierarchy"]
        direction TB
        A["ClerkThemeProvider"] --> B["DemoModeProvider"]
        B --> C["DemoSessionProvider"]
        C --> D["ThemeProvider"]
        D --> E["SWRProvider"]
        E --> F["BrandingProvider"]
        F --> G["SquadProvider"]
        G --> H["OrganizationProvider"]
        H --> I["StreamChatProvider"]
        I --> J["StreamVideoProvider"]
        J --> K["ChatSheetProvider"]
        K --> L["App Content"]
    end

    style A fill:#e1f5fe
    style B fill:#fff3e0
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#e8f5e9
    style F fill:#fce4ec
    style G fill:#e8eaf6
    style H fill:#e0f2f1
    style I fill:#fff8e1
    style J fill:#fff8e1
    style K fill:#f5f5f5
```

## Multi-Tenancy Flow

Tenant resolution happens in the middleware (`src/proxy.ts`):

```mermaid
flowchart LR
    subgraph Request["Incoming Request"]
        R1["app.coachful.co<br/>(Platform)"]
        R2["{org}.coachful.co<br/>(Subdomain)"]
        R3["custom-domain.com<br/>(Custom)"]
    end

    subgraph Middleware["proxy.ts Middleware"]
        Parse["Parse Host"]
        Edge["Edge Config<br/>Lookup"]
        Fallback["API Fallback"]
        Cookie["Set ga_tenant_context<br/>Cookie"]
        Headers["Set x-tenant-*<br/>Headers"]
    end

    subgraph Resolution["Tenant Resolution"]
        Platform["Platform Mode"]
        Tenant["Tenant Mode"]
    end

    R1 --> Parse
    R2 --> Parse
    R3 --> Parse

    Parse --> Edge
    Edge --> |"Hit"| Cookie
    Edge --> |"Miss"| Fallback
    Fallback --> Cookie
    Cookie --> Headers

    Headers --> |"Platform Domain"| Platform
    Headers --> |"Org Domain"| Tenant
```

## Data Flow Architecture

```mermaid
flowchart TB
    subgraph Client["Client"]
        UI["React Components"]
        Hooks["Custom Hooks<br/>(56 hooks)"]
        Context["Context Providers"]
    end

    subgraph DataLayer["Data Layer"]
        SWRCache["SWR Cache"]
        LocalStorage["localStorage<br/>(Theme, Squad Cache)"]
        SessionStorage["sessionStorage<br/>(Demo Data)"]
    end

    subgraph Server["Server"]
        SSR["Server Components"]
        APIRoutes["API Routes"]
    end

    subgraph Database["Database Layer"]
        Firestore["Firestore Collections"]
        EdgeConfig["Vercel Edge Config"]
    end

    UI --> Hooks
    Hooks --> Context
    Hooks --> SWRCache

    Context --> LocalStorage
    Context --> SessionStorage

    SWRCache --> APIRoutes
    SSR --> Firestore
    APIRoutes --> Firestore

    SSR --> EdgeConfig
```

## Firestore Collections

```mermaid
erDiagram
    users ||--o{ goals : has
    users ||--o{ habits : has
    users ||--o{ tasks : has
    users ||--o{ enrollments : has
    users ||--o{ squad_members : joins

    squads ||--o{ squad_members : contains
    squads }o--|| programs : "belongs to"

    programs ||--o{ enrollments : has
    programs ||--o{ program_content : contains

    organizations ||--o{ squads : has
    organizations ||--o{ org_settings : has
    organizations ||--o{ org_branding : has
    organizations ||--o{ org_domains : has

    users {
        string id PK
        string email
        string clerkUserId
        string role
        string onboardingStatus
    }

    squads {
        string id PK
        string name
        string orgId FK
        string programId FK
    }

    programs {
        string id PK
        string title
        string orgId FK
        string coachId FK
    }

    organizations {
        string id PK
        string name
        string subdomain
    }
```

## External Service Integration

```mermaid
flowchart LR
    subgraph App["Coachful App"]
        Auth["Authentication"]
        Data["Data Storage"]
        Chat["Real-time Chat"]
        Video["Video Calls"]
        Pay["Payments"]
        AI["AI Features"]
        Email["Email"]
    end

    subgraph Services["External Services"]
        Clerk["Clerk<br/>• Auth<br/>• Organizations<br/>• User Management"]
        Firebase["Firebase<br/>• Firestore<br/>• Storage<br/>• Auth Tokens"]
        Stream["Stream<br/>• Chat SDK<br/>• Video SDK<br/>• Webhooks"]
        Stripe["Stripe<br/>• Subscriptions<br/>• Connect<br/>• Apple Pay"]
        Claude["Anthropic<br/>• Claude API<br/>• Content Gen"]
        Resend["Resend<br/>• Transactional<br/>• Templates"]
    end

    Auth --> Clerk
    Data --> Firebase
    Chat --> Stream
    Video --> Stream
    Pay --> Stripe
    AI --> Claude
    Email --> Resend
```

## Component Architecture

```mermaid
flowchart TB
    subgraph Components["src/components/"]
        UI["ui/<br/>Base Components<br/>(18 files)"]
        Layout["layout/<br/>Page Structure<br/>(8 files)"]

        subgraph Features["Feature Components"]
            ChatComp["chat/ (20)"]
            CoachComp["coach/ (46)"]
            SquadComp["squad/ (25)"]
            FeedComp["feed/ (19)"]
            ProgramComp["program/ (12)"]
            OnboardComp["onboarding/ (15)"]
            ScheduleComp["scheduling/ (15)"]
        end

        Shared["shared/<br/>Reusable<br/>(7 files)"]
    end

    subgraph Hooks["src/hooks/ (56 hooks)"]
        DataHooks["Data Fetching<br/>useFirebaseUser<br/>useSquad<br/>useHabits"]
        FeatureHooks["Feature Hooks<br/>useScheduling<br/>useCheckInFlow"]
        UIHooks["UI Hooks<br/>useDragToDismiss<br/>useMediaQuery"]
    end

    subgraph Lib["src/lib/ (68 files)"]
        Firebase["firebase*.ts"]
        ClerkLib["clerk-*.ts"]
        AI["anthropic.ts<br/>ai/"]
        Email["email*.ts"]
        Business["Business Logic<br/>program-engine.ts<br/>habit-engine.ts"]
    end

    Features --> Hooks
    Hooks --> Lib
    UI --> Features
    Layout --> Features
```

## User Roles & Permissions

```mermaid
flowchart TB
    subgraph Platform["Platform Roles"]
        SuperAdmin["super_admin<br/>Platform Admin"]
        Admin["admin<br/>Org Admin"]
        Editor["editor<br/>Content Editor"]
        User["user<br/>Regular User"]
    end

    subgraph Org["Organization Roles"]
        SuperCoach["super_coach<br/>Org Owner"]
        Coach["coach<br/>Squad Coach"]
        Member["member<br/>Client/Member"]
    end

    SuperAdmin --> Admin
    Admin --> Editor
    Editor --> User

    SuperCoach --> Coach
    Coach --> Member

    style SuperAdmin fill:#ff5252
    style SuperCoach fill:#ff5252
    style Admin fill:#ff9800
    style Coach fill:#ff9800
    style Editor fill:#4caf50
    style Member fill:#4caf50
    style User fill:#2196f3
```

---

## Summary

Coachful is a **multi-tenant SaaS coaching platform** with:

| Metric | Count |
|--------|-------|
| Page routes | 37+ |
| API endpoints | 60+ |
| Context providers | 11 |
| Custom hooks | 56 |
| Lib utilities | 68 |
| External services | 6 |

**Key Technologies:**
- **Framework:** Next.js 16+ with App Router
- **Auth:** Clerk (multi-tenant organizations)
- **Database:** Firebase Firestore
- **Real-time:** Stream Chat & Video
- **Payments:** Stripe with Connect
- **AI:** Anthropic Claude
- **Email:** Resend
