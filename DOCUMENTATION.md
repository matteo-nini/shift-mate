# Shift Management System - Documentazione Completa

## Panoramica

Sistema completo per la gestione dei turni lavorativi, ferie, permessi e retribuzioni dei dipendenti. L'applicazione supporta sia la modalità di pagamento oraria che quella a turno, con dashboard personalizzate per utenti e amministratori.

---

## Funzionalità

### 👤 Funzionalità Utente

#### Dashboard
- **Statistiche mensili**: Visualizzazione ore lavorate, guadagni stimati, turni di contratto ed extra
- **Grafici interattivi**: Trend mensili con confronto mese precedente, distribuzione guadagni
- **Toggle grafici**: Possibilità di mostrare/nascondere i grafici avanzati

#### I Miei Turni
- **Aggiunta turni**: Inserimento manuale con data, orario inizio/fine, note
- **Marcatura extra**: In modalità €/turno, possibilità di segnare un turno come extra
- **Modifica/Eliminazione**: Gestione completa dei propri turni
- **Cambio stato pagamento**: Toggle tra "Pagato" e "In attesa"

#### Riepilogo
- **Filtro per mese**: Selezione periodo specifico o tutti i mesi
- **Statistiche dettagliate**: Ore/turni contratto vs extra, pagato vs in attesa
- **Tabella turni**: Elenco completo con possibilità di modifica
- **Esportazione**: PDF ed Excel con tutti i dati

#### Ferie & Permessi
- **Richiesta ferie/permessi**: Form con tipo (ferie, permesso, malattia, altro), date e motivazione
- **Calendario visivo**: Visualizzazione mensile delle ferie approvate di tutti
- **Storico richieste**: Elenco delle proprie richieste con stato

#### Impostazioni Personali
- **Data inizio contratto**: Per calcolo automatico turni extra
- **Ore settimanali**: Ore contrattuali per settimana
- **Tariffe personalizzate**: Override delle tariffe di sistema

---

### 👑 Funzionalità Admin

#### Pannello Admin
- **Gestione utenti**: Creazione, modifica, disattivazione account
- **Ruoli**: Assegnazione ruolo admin/user
- **Impostazioni per utente**: Tariffe personalizzate, ore settimanali
- **Import CSV**: Importazione massiva turni da file CSV

#### Calendario Globale
- **Vista calendario**: Tutti i turni di tutti gli utenti
- **Filtro per utente**: Visualizzazione turni di un singolo dipendente
- **Drag & drop**: Modifica turni trascinandoli
- **Assegnazione turni**: Creazione turni per qualsiasi utente

#### Gestione Ferie
- **Approvazione/Rifiuto**: Review delle richieste pendenti
- **Note di revisione**: Possibilità di aggiungere note alla decisione
- **Notifiche email**: Email automatica all'utente quando la richiesta viene processata

#### Logs
- **Modifiche calendario**: Storico di tutte le modifiche ai turni
- **Audit utenti**: Tracciamento azioni sugli account

#### Impostazioni Sistema
- **Metodo pagamento**: €/ora o €/turno
- **Tariffe default**: Tariffa oraria e a turno predefinite
- **Gestione brand**: Logo, nome azienda, colori personalizzati

---

## Architettura

### Frontend (React + TypeScript)

```
src/
├── components/
│   ├── auth/          # Componenti autenticazione
│   ├── dashboard/     # Grafici e statistiche
│   ├── layout/        # Sidebar, MainLayout
│   └── ui/            # Componenti shadcn/ui
├── contexts/
│   └── AuthContext    # Gestione stato autenticazione
├── hooks/
│   ├── useShifts      # CRUD turni personali
│   ├── useSyncShifts  # Sync turni globali
│   ├── useLeaveRequests # Gestione ferie/permessi
│   ├── useUsers       # Gestione utenti (admin)
│   ├── useUserSettings # Impostazioni utente
│   └── useSystemSettings # Impostazioni sistema
├── lib/
│   ├── shiftUtils     # Calcoli ore, guadagni
│   ├── exportUtils    # Export PDF/Excel
│   └── csvUtils       # Parsing CSV
└── pages/
    ├── Dashboard      # Home utente
    ├── MyShifts       # Gestione turni
    ├── Summary        # Riepilogo e statistiche
    ├── GlobalCalendar # Calendario (admin)
    ├── AdminPanel     # Gestione sistema (admin)
    ├── LeaveRequests  # Ferie e permessi
    ├── Logs           # Storico modifiche (admin)
    └── Settings       # Impostazioni personali
```

### Backend (Supabase)

#### Tabelle Database

| Tabella | Descrizione |
|---------|-------------|
| `profiles` | Dati utente (username, nome, email) |
| `user_roles` | Ruoli utente (admin/user) |
| `user_settings` | Impostazioni personali (tariffe, ore) |
| `shifts` | Turni personali |
| `global_shifts` | Turni calendario globale |
| `leave_requests` | Richieste ferie/permessi |
| `system_settings` | Impostazioni di sistema |
| `change_logs` | Log modifiche calendario |
| `user_audit_log` | Audit azioni utenti |

#### Edge Functions

| Funzione | Descrizione |
|----------|-------------|
| `create-user` | Creazione nuovo utente (admin) |
| `notify-shift` | Email notifica nuovo turno |
| `notify-leave-request` | Email notifica ferie approvate/rifiutate |

#### RLS Policies

Tutte le tabelle hanno Row Level Security abilitato:
- Gli utenti vedono solo i propri dati
- Gli admin hanno accesso completo
- Funzioni `is_admin()` e `has_role()` per controllo permessi

---

## Configurazione

### Variabili Ambiente

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SUPABASE_PROJECT_ID=xxx
```

### Secrets Supabase

| Secret | Descrizione |
|--------|-------------|
| `RESEND_API_KEY` | API key per invio email |
| `SUPABASE_SERVICE_ROLE_KEY` | Key per operazioni admin |

### Impostazioni Sistema

Configurabili dal pannello admin:
- **payment_method**: `hourly` o `per_shift`
- **default_hourly_rate**: Tariffa oraria default (€)
- **default_shift_rate**: Tariffa a turno default (€)
- **company_name**: Nome azienda
- **company_logo_url**: URL logo aziendale
- **primary_color**: Colore primario brand

---

## Calcolo Retribuzioni

### Modalità Oraria (€/ora)
- Ore contratto: `ore_lavorate × tariffa_oraria`
- Ore extra: `ore_extra × tariffa_extra`
- Le ore extra sono calcolate automaticamente superando le ore settimanali

### Modalità a Turno (€/turno)
- Turno contratto: `tariffa_turno`
- Turno extra: `tariffa_turno` (marcato manualmente)
- Non importa la durata del turno

---

## Tecnologie Utilizzate

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui, Framer Motion
- **State**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Charts**: Recharts
- **Export**: jsPDF, xlsx
- **Email**: Resend

---

## Sicurezza

- Autenticazione via Supabase Auth
- RLS policies su tutte le tabelle
- Ruoli separati in tabella dedicata (prevenzione privilege escalation)
- Controllo admin server-side con `SECURITY DEFINER` functions
- CORS configurato per edge functions

---

## Deployment

L'applicazione è deployata su Lovable con:
- Frontend: Build statico Vite
- Backend: Supabase Cloud
- Edge Functions: Deploy automatico

Per pubblicare aggiornamenti:
1. Le modifiche frontend richiedono click su "Update" nel dialog publish
2. Le modifiche backend (edge functions, migrations) sono deployate automaticamente
