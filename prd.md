# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# Restaurant & Bar Ordering PWA — Django
## Sistem Pemesanan Restoran & Bar Berbasis Progressive Web Application dengan Verifikasi Kasir

**Document ID:** PRD-RESTO-PWA-001  
**Version:** 2.1.0 (Production-Ready Refactor)  
**Status:** Production-Ready Engineering Baseline / Thesis-Compatible  
**Target Restaurant:** Celvass Resto & Bar (Av. de Portugal, Dili, Timor-Leste)  
**Supported Languages:** Tetun (Official), Português (Official), English (International), Bahasa Indonesia  
**Primary Framework:** Django 5.2 LTS  
**Primary Database:** PostgreSQL 18.4+ (with local SQLite fallback for dev)  
**Architecture:** Local-Edge Modular Monolith + REST API + WebSocket + Transactional Outbox + PWA  
**Target Deployment:** Celvass Resto & Bar Production — Local Edge Primary + Daphne ASGI Server  
**Primary Context:** Restoran & Bar di Dili, Timor-Leste dengan mata uang USD ($) dan gerbang verifikasi kasir  
**Document Language:** Bahasa Indonesia, Tetun, Português, English  
**Last Baseline Review:** 2026-08-31  

---

# 0. TUJUAN DOKUMEN

Dokumen ini adalah sumber kebenaran utama (single source of truth) untuk membangun, menguji, men-deploy, mengoperasikan, memonitor, mem-backup, memulihkan, dan memelihara sistem Restaurant Ordering PWA pada lingkungan produksi nyata.

Dokumen ini sengaja ditulis sangat eksplisit agar implementasi dapat dikerjakan oleh:

- junior developer;
- mahasiswa;
- tim kecil;
- AI coding agent dengan kemampuan terbatas;
- reviewer yang tidak ikut merancang sistem dari awal.

Implementor **TIDAK BOLEH** mengubah business rule inti hanya karena implementasi alternatif terlihat lebih cepat.

Jika ada konflik antara:

1. kode;
2. komentar kode;
3. UI;
4. dokumentasi tambahan;
5. dokumen PRD ini;

maka PRD ini menjadi acuan sampai PRD diperbarui secara resmi.

---

# 0.1 ATURAN EKSEKUSI UNTUK DEVELOPER DAN AI AGENT

Setiap task implementasi harus mengikuti urutan:

1. Baca requirement terkait.
2. Baca business rule.
3. Baca state transition.
4. Baca schema database.
5. Baca API contract.
6. Buat atau perbarui test terlebih dahulu bila behavior sudah didefinisikan.
7. Implementasi logic pada service layer.
8. Hubungkan view/API/UI.
9. Jalankan unit test.
10. Jalankan integration test.
11. Jalankan lint/static check.
12. Jalankan migration check.
13. Verifikasi acceptance criteria.
14. Update changelog/task status.

Dilarang:

- menaruh business logic utama di template;
- mempercayai harga dari browser;
- mempercayai `table_id` mentah dari browser tanpa validasi;
- membuat order langsung masuk dapur tanpa cashier confirmation;
- mengubah order yang sudah `PREPARING` dari customer UI;
- menyimpan nilai uang menggunakan float;
- menganggap request gagal berarti transaksi database pasti gagal;
- membuat retry POST tanpa idempotency;
- menjadikan cache sebagai sumber kebenaran transaksi;
- menjadikan WebSocket sebagai sumber kebenaran data;
- menghapus audit log transaksi penting;
- menganggap QR Code sebagai authentication penuh;
- menyimpan secret dalam repository;
- menggunakan SQLite untuk production.

---

# 0.2 DEFINISI PRIORITAS

| Label | Arti |
|---|---|
| MUST | Wajib untuk MVP/sidang |
| SHOULD | Sangat disarankan |
| COULD | Opsional |
| WON'T-MVP | Tidak dikerjakan pada MVP |

---

# 1. RINGKASAN PRODUK

Sistem adalah Progressive Web Application untuk restoran dine-in.

Pelanggan:

1. berada di restoran;
2. memilih/menempati meja;
3. mengakses PWA dari QR Code atau URL;
4. melihat menu;
5. membuat pesanan;
6. mengirim pesanan;
7. menunggu verifikasi kasir;
8. melihat status pesanan.

Kasir:

1. membuka sesi meja;
2. menerima pending order;
3. memverifikasi pelanggan/order;
4. mengkonfirmasi atau menolak order;
5. menangani bill;
6. mencatat pembayaran;
7. menutup sesi meja.

Dapur:

1. hanya melihat order yang sudah dikonfirmasi kasir;
2. memulai proses;
3. menandai order siap;
4. melihat catatan item.

Admin:

1. mengelola menu;
2. kategori;
3. meja;
4. user/staff;
5. harga;
6. ketersediaan menu;
7. laporan;
8. konfigurasi restoran;
9. audit dasar.

Tidak ada kewajiban mobile banking atau payment gateway pada MVP.

---

# 2. LATAR BELAKANG MASALAH

Kondisi yang menjadi dasar desain:

- pemesanan manual dapat menimbulkan salah catat;
- waiter/kasir dapat menjadi bottleneck;
- pelanggan perlu cara melihat dan memilih menu secara mandiri;
- payment gateway/mobile banking tidak selalu tersedia atau praktis;
- order online tanpa verifikasi membuka risiko fake order;
- koneksi internet/Wi-Fi dapat tidak stabil;
- smartphone pelanggan berbeda-beda;
- sistem harus dapat dijalankan tanpa instalasi native application;
- dapur membutuhkan urutan dan status order yang jelas;
- kasir harus tetap menjadi titik kontrol sebelum bahan makanan diproses.

Solusi yang diusulkan adalah PWA dengan **cashier confirmation gate**.

---

# 3. USULAN JUDUL SKRIPSI

Judul utama yang direkomendasikan:

**Rancang Bangun Sistem Pemesanan Makanan Berbasis Progressive Web Application (PWA) dengan Mekanisme Verifikasi Pesanan oleh Kasir pada Restoran**

Alternatif:

**Implementasi Progressive Web Application pada Sistem Pemesanan Restoran dengan Verifikasi Kasir untuk Mitigasi Pesanan Palsu**

Catatan:

- istilah “mengeliminasi fake order” sebaiknya tidak digunakan sebagai klaim absolut;
- gunakan “mengurangi risiko”, “memitigasi”, atau “mencegah pesanan tidak terverifikasi diproses dapur”;
- efektivitas harus dibuktikan melalui pengujian.

---

# 4. RUMUSAN MASALAH

1. Bagaimana merancang PWA untuk proses pemesanan dine-in tanpa mewajibkan instalasi aplikasi?
2. Bagaimana menerapkan verifikasi kasir sebelum order diproses dapur?
3. Bagaimana mencegah duplicate order dan membatasi fake/spam order?
4. Bagaimana menjaga konsistensi status order saat customer, kasir, dan dapur mengakses data secara bersamaan?
5. Bagaimana sistem berperilaku saat koneksi tidak stabil?
6. Bagaimana memastikan harga, total, status, dan pembayaran tidak dapat dimanipulasi dari browser?
7. Bagaimana mengukur fungsionalitas, performa, reliability, dan usability dari sistem?

---

# 5. TUJUAN PENELITIAN

1. Membangun PWA pemesanan restoran berbasis Django.
2. Membangun mekanisme QR/table session.
3. Membangun cashier confirmation gate.
4. Membangun kitchen queue.
5. Membangun pencatatan transaksi pembayaran di kasir.
6. Membangun proteksi duplicate/spam/fake order.
7. Menerapkan keamanan backend dan kontrol role.
8. Menerapkan real-time status dengan fallback.
9. Menguji sistem secara end-to-end.
10. Mengukur performa dan usability.

---

# 6. NILAI TEKNIS / KONTRIBUSI PROYEK

Kontribusi teknis yang dapat diuji:

- controlled ordering workflow;
- table-session validation;
- idempotent order submission;
- concurrency-safe state transition;
- cashier approval workflow;
- PWA installability;
- controlled offline behavior;
- real-time kitchen/cashier/customer synchronization;
- auditability;
- server-authoritative pricing;
- cash-oriented payment flow.

---

# 7. RUANG LINGKUP MVP

## 7.1 Termasuk

- dine-in;
- QR Code per meja;
- table session;
- customer ordering;
- kategori dan menu;
- cart;
- catatan item;
- cashier confirmation;
- kitchen queue;
- order tracking;
- cash payment;
- optional manual non-cash label tanpa gateway;
- user/role;
- reports dasar;
- PWA;
- responsive UI;
- WebSocket + fallback polling;
- audit log;
- rate limiting;
- idempotency;
- deployment Docker;
- backup PostgreSQL;
- automated tests.

## 7.2 Tidak termasuk MVP

- delivery;
- GPS;
- marketplace;
- multi-branch;
- payment gateway;
- mobile banking integration;
- QRIS;
- loyalty;
- inventory recipe deduction;
- payroll;
- accounting ledger penuh;
- AI recommendation;
- ANPR;
- native Android/iOS;
- offline transaction finalization;
- customer account wajib;
- reservation online publik.

---

# 8. AKTOR

## 8.1 Customer

Tidak wajib memiliki akun.

Hak:

- melihat menu;
- membuat cart;
- submit order untuk table session valid;
- melihat order milik session;
- melihat status;
- meminta bill;
- melihat total bill.

Tidak boleh:

- mengkonfirmasi order;
- mengubah harga;
- mengganti meja arbitrary;
- mengubah order setelah cutoff;
- menandai pembayaran;
- mengubah status dapur.

## 8.2 Cashier

Hak:

- login;
- open table;
- close table;
- lihat pending confirmation;
- confirm/reject order;
- buat order manual;
- lihat bill;
- catat payment;
- void tertentu sesuai permission;
- cetak/lihat receipt.

## 8.3 Kitchen

Hak:

- login;
- melihat order `CONFIRMED`/`PREPARING`;
- ubah `CONFIRMED -> PREPARING`;
- ubah `PREPARING -> READY`;
- lihat item dan notes;
- tandai unavailable melalui flow yang diizinkan.

Tidak boleh:

- edit price;
- confirm payment;
- manage staff;
- mengubah completed order.

## 8.4 Admin

Hak:

- seluruh konfigurasi operasional;
- manage menu;
- manage categories;
- manage tables;
- manage users;
- reports;
- audit log;
- restaurant settings;
- force close dengan alasan;
- void dengan alasan dan audit.

## 8.5 Superadmin Teknis

Hanya untuk deployment/maintenance.

---

# 9. TERMINOLOGI DOMAIN

## Table

Meja fisik restoran.

## Table Session

Sesi penggunaan meja dari saat kasir membuka meja sampai bill diselesaikan dan meja ditutup.

## Order

Satu batch pesanan yang dikirim customer/staff.

Satu table session dapat memiliki banyak order.

## Bill

Akumulasi order valid pada satu table session yang menjadi tagihan.

## Order Item

Snapshot item menu pada saat order dibuat.

## Confirmation

Keputusan kasir bahwa order sah untuk diproses dapur.

## Payment

Catatan pembayaran terhadap bill/table session.

## Idempotency Key

Token unik yang memastikan retry request tidak membuat order kedua.

## QR Token

Identifier acak untuk meja, bukan sequential database ID.

---

# 10. BUSINESS RULE PALING PENTING

BR-001: Order customer tidak boleh masuk kitchen queue sebelum kasir confirm.

BR-002: Harga final selalu dihitung server.

BR-003: `total_amount` tidak dipercaya dari client.

BR-004: `subtotal = server_price_snapshot * quantity`.

BR-005: Uang disimpan sebagai Decimal/Numeric.

BR-006: Satu table hanya boleh memiliki satu active table session.

BR-007: Table session harus `OPEN` agar customer dapat submit order.

BR-008: Order yang sudah `CONFIRMED` tidak dapat diedit customer.

BR-009: Order yang `PREPARING` tidak boleh dibatalkan customer.

BR-010: Payment hanya dapat dicatat oleh authorized staff.

BR-011: Bill tidak dapat ditutup jika masih ada order dalam state yang belum selesai atau kebijakan override admin tidak digunakan.

BR-012: Table tidak menjadi `AVAILABLE` sampai table session selesai ditutup.

BR-013: Duplicate idempotency key mengembalikan result sebelumnya, bukan membuat order baru.

BR-014: Status transition harus divalidasi server.

BR-015: Semua critical transition dicatat ke audit/status log.

BR-016: QR token tidak boleh sama dengan numeric table ID.

BR-017: QR token dapat dirotate.

BR-018: Customer tidak memperoleh endpoint daftar semua table sessions.

BR-019: Customer session token hanya memberi akses pada session terkait.

BR-020: Cache tidak boleh menjadi sumber kebenaran order/payment.

---

# 11. STATE MACHINE

# 11.1 Table Status

```text
AVAILABLE
   |
   | cashier opens
   v
OCCUPIED
   |
   | session paid/closed
   v
CLEANING (optional)
   |
   | ready
   v
AVAILABLE

MAINTENANCE dapat dimasuki admin dari AVAILABLE.
```

Allowed:

- AVAILABLE -> OCCUPIED
- OCCUPIED -> CLEANING
- CLEANING -> AVAILABLE
- AVAILABLE -> MAINTENANCE
- MAINTENANCE -> AVAILABLE

Forbidden example:

- AVAILABLE -> CLEANING tanpa reason;
- MAINTENANCE -> OCCUPIED.

# 11.2 Table Session Status

```text
OPEN
  |
  +--> BILL_REQUESTED
  |       |
  |       v
  |      PAID
  |       |
  |       v
  +----> CLOSED

OPEN -> CANCELLED hanya admin/cashier sesuai kondisi
```

Canonical states:

- OPEN
- BILL_REQUESTED
- PAYMENT_PENDING
- PAID
- CLOSED
- CANCELLED

# 11.3 Order Status

```text
DRAFT
  |
  v
WAITING_CASHIER_CONFIRMATION
  |                   |
  | confirm           | reject
  v                   v
CONFIRMED           REJECTED
  |
  v
PREPARING
  |
  v
READY
  |
  v
SERVED
  |
  v
COMPLETED
```

Additional terminal state:

- CANCELLED

Rules:

- Customer submit creates `WAITING_CASHIER_CONFIRMATION`.
- Kitchen tidak menerima `WAITING_CASHIER_CONFIRMATION`.
- Cashier confirm sets `confirmed_by`, `confirmed_at`.
- Rejection requires reason.
- Cancel after confirmation requires staff privilege and reason.
- Transition executed atomically.

# 11.4 Payment Status

- PENDING
- COMPLETED
- VOIDED
- REFUNDED

MVP tidak membutuhkan refund otomatis, tetapi schema mendukung audit.

---

# 12. HIGH-LEVEL USER FLOW

## 12.1 Customer

```text
Scan QR
-> Resolve table
-> Validate/open session
-> Browse menu
-> Add items
-> Review cart
-> Submit
-> Server validates
-> Order WAITING_CASHIER_CONFIRMATION
-> Customer receives order code
-> Cashier confirms
-> Customer sees CONFIRMED
-> Kitchen prepares
-> READY
-> SERVED
-> Customer requests bill
-> Cashier collects cash
-> Payment completed
-> Session closed
```

## 12.2 Cashier

```text
Login
-> Open table
-> Customer orders
-> Pending alert
-> Inspect table/order/items
-> Confirm or reject
-> Monitor bill
-> Receive bill request
-> Verify total
-> Receive cash
-> Enter tendered amount
-> Server calculates change
-> Complete payment
-> Close session
```

## 12.3 Kitchen

```text
Login
-> Queue
-> New CONFIRMED order
-> Start -> PREPARING
-> Finish -> READY
-> Handover -> SERVED
```

---

# 13. ARSITEKTUR SISTEM

```text
+----------------------+       HTTPS        +------------------------+
| Customer PWA         | -----------------> | Nginx / Reverse Proxy  |
+----------------------+                    +-----------+------------+
                                                       |
+----------------------+                               |
| Cashier PWA          | ------------------------------+
+----------------------+                               |
                                                       v
+----------------------+                    +------------------------+
| Kitchen PWA          |                    | Django ASGI App        |
+----------------------+                    | Templates + REST API   |
                                            | Channels/WebSocket     |
+----------------------+                    +-----------+------------+
| Admin Web            |                                |
+----------------------+              +-----------------+----------------+
                                      |                                  |
                                      v                                  v
                              +---------------+                    +------------+
                              | PostgreSQL    |                    | Redis      |
                              | source truth  |                    | cache/ws   |
                              +---------------+                    +------------+
                                      |
                                      v
                              +---------------+
                              | Backup        |
                              +---------------+
```

Architecture style:

- modular monolith;
- single deployable Django project;
- domain separated into Django apps;
- no microservice for MVP.

Reason:

- lebih mudah di-deploy;
- lebih mudah debugging;
- lebih sesuai skripsi;
- transaction boundary lebih sederhana;
- biaya operasional lebih rendah.

---

# 14. TECH STACK

# 14.1 Backend

**Python 3.13.x**

**Django 5.2 LTS**

Baseline package policy:

- gunakan patch terbaru dari Django 5.2 LTS;
- pin dependency pada lock file;
- upgrade patch setelah test;
- major upgrade tidak dilakukan di tengah skripsi tanpa review.

# 14.2 API

**Django REST Framework**

Dipakai untuk:

- customer API;
- cashier API;
- kitchen API;
- admin API bila diperlukan;
- OpenAPI-compatible structured endpoints.

# 14.3 Real-Time

**Django Channels 4.x**
**channels-redis**
**Redis**

Transport:

- WebSocket utama;
- REST polling fallback.

WebSocket bukan database.

# 14.4 Database

**PostgreSQL 18.4+** sebagai baseline production.

MUST:

- foreign keys;
- unique constraints;
- check constraints;
- indexes;
- transactions;
- row locking untuk critical transition.

# 14.5 Cache / Channel Layer

**Redis**

Use:

- Channels channel layer;
- rate-limit counters jika dibutuhkan;
- short-lived cache;
- ephemeral coordination.

Do not use Redis as canonical order/payment storage.

# 14.6 Background Jobs

**Celery 5.5.x + Redis broker** untuk task yang benar-benar asynchronous.

MVP jobs:

- expire stale pending order;
- cleanup expired anonymous session metadata;
- scheduled report aggregation optional;
- backup notification optional.

Jika deployment sangat minimal, expiration juga dapat dijalankan via Django management command + cron. Tetapi arsitektur default PRD adalah Celery.

# 14.7 Frontend

**Django Templates**
**Bootstrap 5.3.x**
**Vanilla JavaScript ES2022+**

Alasan tidak mewajibkan React/Vue:

- mengurangi build complexity;
- satu repository;
- authentication/session lebih mudah;
- junior developer lebih mudah;
- PWA tetap dapat dibangun;
- WebSocket tetap dapat dipakai;
- skripsi fokus pada sistem, bukan SPA tooling.

Optional enhancement:

- HTMX dapat ditambahkan setelah MVP, tetapi bukan dependency wajib.

# 14.8 PWA

- `manifest.webmanifest`;
- service worker custom;
- Cache Storage API;
- installable metadata;
- icons;
- offline fallback;
- versioned cache;
- update strategy.

# 14.9 ASGI Server

**Daphne** sebagai baseline karena integrasi Channels.

Production topology:

`Nginx -> Daphne -> Django ASGI`.

# 14.10 Static/Media

MVP:

- static assets via WhiteNoise atau Nginx;
- media menu images via filesystem mounted volume.

Production scalable:

- object storage optional.

# 14.11 Testing

- pytest;
- pytest-django;
- Django TransactionTestCase untuk locking tests;
- factory_boy;
- Playwright untuk E2E browser;
- Channels communicator tests;
- coverage.py.

# 14.12 Quality

- Ruff;
- Black;
- mypy optional SHOULD;
- pre-commit;
- djLint optional for templates.

# 14.13 Deployment

- Docker;
- Docker Compose;
- Nginx;
- PostgreSQL;
- Redis;
- Django/Daphne;
- Celery worker;
- Celery beat if periodic schedule required.

# 14.14 Source Control

- Git;
- feature branches;
- pull request/review optional;
- semantic-ish version tag.

---

# 15. VERSION BASELINE

Baseline produksi yang diverifikasi pada 2026-08-13:

```text
Python                 3.13.x
Django                 5.2.17 LTS
djangorestframework    3.18.0
channels               4.3.2
channels-redis         compatible 4.3.x
daphne                 compatible 4.2.x
celery                 5.6.3
psycopg[binary,pool]   current compatible 3.x
PostgreSQL             18.4+
Redis Server           supported stable release
Bootstrap              5.3.x
Node.js                NOT REQUIRED for core MVP
```

Final production lock/build artifact MUST pin exact resolved versions. Patch/security release takes priority over convenience pinning. Major/minor dependency changes require staging, concurrency, PWA, WebSocket, migration, and E2E regression.

---

# 16. REPOSITORY STRUCTURE

```text
restaurant_pwa/
├── README.md
├── CHANGELOG.md
├── prd.md
├── .env.example
├── .gitignore
├── pyproject.toml
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
├── docker/
│   ├── django/
│   │   └── Dockerfile
│   └── nginx/
│       └── default.conf
├── docker-compose.yml
├── docker-compose.prod.yml
├── manage.py
├── config/
│   ├── __init__.py
│   ├── asgi.py
│   ├── urls.py
│   ├── celery.py
│   └── settings/
│       ├── __init__.py
│       ├── base.py
│       ├── local.py
│       ├── test.py
│       └── production.py
├── apps/
│   ├── accounts/
│   ├── restaurants/
│   ├── tables/
│   ├── catalog/
│   ├── ordering/
│   ├── kitchen/
│   ├── payments/
│   ├── reporting/
│   ├── audit/
│   └── pwa/
├── templates/
│   ├── base/
│   ├── customer/
│   ├── cashier/
│   ├── kitchen/
│   └── admin_custom/
├── static/
│   ├── css/
│   ├── js/
│   ├── icons/
│   └── pwa/
├── media/
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── scripts/
└── docs/
    ├── architecture.md
    ├── api.md
    ├── deployment.md
    ├── runbook.md
    └── testing.md
```

---

# 17. DJANGO APP RESPONSIBILITY

## accounts

- custom user model;
- roles;
- login/logout;
- permissions;
- password policies.

## restaurants

- restaurant identity;
- settings;
- currency;
- timezone;
- operational flags.

## tables

- restaurant table;
- QR token;
- table session;
- open/close table.

## catalog

- categories;
- menu items;
- prices;
- availability;
- menu images.

## ordering

- orders;
- order items;
- order state machine;
- idempotency;
- order calculation.

## kitchen

- kitchen views;
- kitchen state transitions;
- queue selectors.

## payments

- bill;
- payment;
- cash tender;
- change;
- receipt.

## reporting

- daily sales;
- order counts;
- cancellation;
- payment summary.

## audit

- audit event;
- security event.

## pwa

- manifest;
- service-worker URL;
- offline page;
- install UI helpers.

---

# 18. CODING ARCHITECTURE

Gunakan layer:

```text
models.py
services.py
selectors.py
api/
  serializers.py
  views.py
  urls.py
permissions.py
validators.py
exceptions.py
tasks.py
consumers.py
routing.py
tests/
```

## Service

Semua mutation/business transaction.

Example:

```python
confirm_order(...)
start_preparing(...)
mark_order_ready(...)
record_payment(...)
open_table_session(...)
close_table_session(...)
```

## Selector

Read/query logic.

Example:

```python
get_pending_cashier_orders(...)
get_kitchen_queue(...)
get_active_table_session(...)
```

Rule:

view tipis.

Bad:

```python
def view(request):
    # 80 lines transaction/business logic
```

Good:

```python
def view(request):
    data = validate(...)
    result = order_service.submit_order(...)
    return response(result)
```

---

# 19. MONEY & CURRENCY

Timor-Leste menggunakan USD sebagai konteks operasional.

Database:

```text
NUMERIC(12,2)
```

Django:

```python
DecimalField(max_digits=12, decimal_places=2)
```

Dilarang:

```python
float
```

Rounding:

- gunakan Decimal;
- gunakan `ROUND_HALF_UP` jika diperlukan;
- seluruh subtotal dan total dihitung server;
- currency code simpan `USD`.

Example:

```text
price: 3.50
qty: 2
subtotal: 7.00
```

Cash tender:

```text
bill_total     17.50
cash_received  20.00
change_due      2.50
```

Server menghitung change.

---

# 20. TIME

Canonical database timestamps:

- timezone-aware;
- Django `USE_TZ = True`.

Business display:

- `Asia/Dili`.

Fields:

- `created_at`;
- `updated_at`;
- `confirmed_at`;
- `started_preparing_at`;
- `ready_at`;
- `served_at`;
- `completed_at`;
- `opened_at`;
- `closed_at`;
- `paid_at`.

Jangan menyimpan formatted date sebagai string.

---

# 21. DATABASE CONVENTIONS

Primary key:

- UUID direkomendasikan untuk entities eksternal/sensitive;
- BigAutoField boleh untuk internal reference.

External code:

```text
ORD-20260813-XXXXXX
```

Jangan menggunakan incremental primary key sebagai public security token.

Soft delete untuk:

- menu item;
- category bila terkait history;
- staff account.

Order/payment tidak di-hard-delete dari UI.

---

# 22. DATABASE SCHEMA

# 22.1 users

| Field | Type | Null | Rule |
|---|---|---:|---|
| id | UUID | no | PK |
| username/email | varchar | no | unique |
| password | Django hash | no | never plaintext |
| full_name | varchar(150) | no | |
| role | enum/string | no | ADMIN/CASHIER/KITCHEN |
| is_active | boolean | no | default true |
| is_staff | boolean | no | |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

Indexes:

- username/email unique;
- role, is_active.

# 22.2 restaurants

| Field | Type |
|---|---|
| id | UUID |
| name | varchar(150) |
| legal_name | varchar(200) nullable |
| phone | varchar(50) nullable |
| address | text nullable |
| currency | char(3), default USD |
| timezone | varchar(50), default Asia/Dili |
| is_active | bool |
| created_at | timestamptz |
| updated_at | timestamptz |

MVP hanya satu restaurant row, tetapi FK tetap dipakai untuk future compatibility.

# 22.3 restaurant_tables

| Field | Type | Rule |
|---|---|---|
| id | UUID | PK |
| restaurant_id | UUID FK | |
| table_code | varchar(30) | unique per restaurant |
| display_name | varchar(80) | |
| capacity | positive int | nullable |
| qr_token | varchar(128) | unique random |
| status | varchar(20) | state |
| sort_order | int | |
| is_active | bool | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Constraints:

- capacity > 0 if provided;
- unique restaurant + table_code;
- qr_token globally unique.

# 22.4 table_sessions

| Field | Type | Rule |
|---|---|---|
| id | UUID | PK |
| restaurant_id | FK | |
| table_id | FK | |
| public_token | varchar(128) | unique |
| status | varchar(30) | |
| guest_count | int nullable | >=1 |
| opened_by | FK user | |
| opened_at | timestamptz | |
| bill_requested_at | timestamptz nullable | |
| paid_at | timestamptz nullable | |
| closed_by | FK nullable | |
| closed_at | timestamptz nullable | |
| close_reason | text nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Critical DB rule:

Hanya satu active session per table.

Implement partial unique constraint untuk status aktif:

```text
OPEN
BILL_REQUESTED
PAYMENT_PENDING
PAID
```

Atau domain active flag yang dijaga transaction.

Index:

- table_id + status;
- public_token unique;
- opened_at.

# 22.5 categories

| Field | Type |
|---|---|
| id | UUID |
| restaurant_id | FK |
| name | varchar(100) |
| slug | varchar(120) |
| description | text nullable |
| sort_order | int |
| is_active | bool |
| created_at | timestamptz |
| updated_at | timestamptz |

Unique restaurant + slug.

# 22.6 menu_items

| Field | Type |
|---|---|
| id | UUID |
| restaurant_id | FK |
| category_id | FK |
| sku | varchar(50) nullable |
| name | varchar(150) |
| slug | varchar(180) |
| description | text |
| price | numeric(12,2) |
| image | path/url nullable |
| availability | AVAILABLE/SOLD_OUT/INACTIVE |
| is_featured | bool |
| sort_order | int |
| preparation_note | text nullable |
| created_at | timestamptz |
| updated_at | timestamptz |

Constraints:

- price >= 0;
- unique restaurant + slug;
- unique restaurant + sku where not null.

# 22.7 orders

| Field | Type | Rule |
|---|---|---|
| id | UUID | PK |
| restaurant_id | FK | |
| table_session_id | FK | required |
| order_code | varchar(40) | unique |
| source | CUSTOMER/CASHIER | |
| status | varchar(40) | state |
| idempotency_key | varchar(128) | scoped unique |
| subtotal | numeric(12,2) | server |
| discount_total | numeric(12,2) | 0 MVP |
| tax_total | numeric(12,2) | config |
| grand_total | numeric(12,2) | server |
| customer_note | text nullable | sanitized |
| rejection_reason | text nullable | |
| cancellation_reason | text nullable | |
| submitted_at | timestamptz | |
| confirmed_by | FK nullable | |
| confirmed_at | timestamptz nullable | |
| created_by | FK nullable | cashier order |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Constraints:

- amount >= 0;
- unique table_session + idempotency_key;
- confirmed fields consistent where possible.

Indexes:

- status + created_at;
- table_session_id + created_at;
- confirmed_at.

# 22.8 order_items

Snapshot fields penting agar perubahan menu masa depan tidak mengubah histori.

| Field | Type |
|---|---|
| id | UUID |
| order_id | FK |
| menu_item_id | FK nullable/protect |
| menu_name_snapshot | varchar(150) |
| sku_snapshot | varchar(50) nullable |
| unit_price | numeric(12,2) |
| quantity | positive integer |
| subtotal | numeric(12,2) |
| note | varchar(500) nullable |
| created_at | timestamptz |

Rules:

- quantity 1..99 configurable;
- subtotal = unit_price * quantity;
- menu unavailable -> cannot add at submit.

# 22.9 order_status_history

| Field | Type |
|---|---|
| id | UUID |
| order_id | FK |
| from_status | varchar nullable |
| to_status | varchar |
| actor_user_id | FK nullable |
| actor_type | CUSTOMER/STAFF/SYSTEM |
| reason | text nullable |
| request_id | UUID/string |
| created_at | timestamptz |

Append-only.

# 22.10 bill_requests

Optional explicit model.

| Field | Type |
|---|---|
| id | UUID |
| table_session_id | FK |
| status | PENDING/ACKNOWLEDGED/COMPLETED/CANCELLED |
| requested_at | timestamptz |
| acknowledged_by | FK nullable |
| acknowledged_at | timestamptz nullable |

MVP juga dapat menggunakan fields pada table_session; jika model ini dipakai, jangan duplikasi source-of-truth.

Decision default:

**gunakan field table_session untuk MVP**, model bill_requests hanya future.

# 22.11 payments

| Field | Type |
|---|---|
| id | UUID |
| restaurant_id | FK |
| table_session_id | FK |
| payment_code | varchar(40) unique |
| method | CASH/MANUAL_OTHER |
| amount | numeric(12,2) |
| tendered_amount | numeric(12,2) nullable |
| change_amount | numeric(12,2) nullable |
| status | PENDING/COMPLETED/VOIDED |
| received_by | FK user |
| paid_at | timestamptz nullable |
| voided_by | FK nullable |
| void_reason | text nullable |
| idempotency_key | varchar(128) |
| created_at | timestamptz |
| updated_at | timestamptz |

MVP business rule:

- full payment only;
- split payment WON'T-MVP.

# 22.12 audit_events

| Field | Type |
|---|---|
| id | UUID |
| actor_user_id | FK nullable |
| actor_role | varchar nullable |
| action | varchar(100) |
| entity_type | varchar(80) |
| entity_id | varchar(100) |
| before_data | JSONB nullable |
| after_data | JSONB nullable |
| ip_hash_or_ip | configurable |
| user_agent | text nullable |
| request_id | varchar(100) |
| created_at | timestamptz |

Audit actions:

- LOGIN_SUCCESS;
- LOGIN_FAILURE;
- TABLE_OPEN;
- TABLE_CLOSE;
- ORDER_CONFIRM;
- ORDER_REJECT;
- ORDER_CANCEL;
- PAYMENT_COMPLETE;
- PAYMENT_VOID;
- MENU_PRICE_CHANGE;
- USER_ROLE_CHANGE;
- QR_ROTATE.

# 22.13 idempotency_records

Optional if order table key tidak cukup.

Recommended generic model:

| Field | Type |
|---|---|
| id | UUID |
| scope | varchar |
| key | varchar |
| request_hash | varchar |
| response_status | int |
| response_body | JSONB |
| resource_type | varchar |
| resource_id | varchar |
| expires_at | timestamptz |
| created_at | timestamptz |

Unique scope + key.

---

# 23. CRITICAL DATABASE TRANSACTIONS

# 23.1 Open Table

Pseudo:

```text
BEGIN
lock table row
verify table AVAILABLE
verify no active session
create session OPEN
update table OCCUPIED
audit
COMMIT
```

On error:

```text
ROLLBACK
```

# 23.2 Submit Order

```text
BEGIN
lock relevant active table session
validate session OPEN
validate idempotency
load menu rows server-side
validate availability
calculate amount using DB price
create order WAITING_CASHIER_CONFIRMATION
create order item snapshots
create history
store idempotency result
COMMIT

after commit:
broadcast cashier event
```

Important:

WebSocket publish only after transaction commit.

# 23.3 Confirm Order

```text
BEGIN
SELECT order FOR UPDATE
verify status WAITING_CASHIER_CONFIRMATION
verify table session active
set CONFIRMED
set confirmed_by
set confirmed_at
append history
audit
COMMIT

after commit:
broadcast kitchen
broadcast customer
```

# 23.4 Start Preparing

```text
BEGIN
lock order
verify CONFIRMED
set PREPARING
append history
COMMIT
broadcast
```

# 23.5 Complete Payment

```text
BEGIN
lock table session
lock existing payment rows as necessary
calculate bill from valid orders server-side
verify all billable orders
verify no prior completed full payment
validate tendered >= total for CASH
create/complete payment
calculate change
set session PAID
audit
COMMIT
broadcast
```

# 23.6 Close Session

```text
BEGIN
lock session
lock table
verify PAID or authorized override
verify no active kitchen states
set session CLOSED
set table CLEANING/AVAILABLE according setting
audit
COMMIT
```

---

# 24. ORDER TOTAL CALCULATION

Never:

```text
client sends:
price=1
total=1
```

Canonical algorithm:

```text
for each requested item:
    fetch MenuItem by ID within same restaurant
    require availability == AVAILABLE
    require quantity in valid range
    unit_price = DB menu price
    subtotal = unit_price * quantity
sum item subtotal
tax = configured rule
discount = approved server-side rule
grand_total = subtotal + tax - discount
```

The browser may display estimated total, tetapi server response menentukan final total.

If display price differs from current DB price:

return warning or accept server price depending UX.

Recommended:

- if price changed since cart fetch, return `409 PRICE_CHANGED`;
- response contains new price;
- customer reconfirms cart.

---

# 25. API DESIGN PRINCIPLES

Base:

```text
/api/v1/
```

JSON response success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "..."
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_INVALID_STATE",
    "message": "Order tidak dapat diproses pada status saat ini.",
    "details": {}
  },
  "meta": {
    "request_id": "..."
  }
}
```

Do not expose stack traces.

---

# 26. HTTP STATUS CONVENTION

| Status | Use |
|---|---|
| 200 | success read/update |
| 201 | created |
| 204 | no content |
| 400 | malformed/validation |
| 401 | not authenticated |
| 403 | authenticated but forbidden |
| 404 | resource not visible/not found |
| 409 | state conflict/idempotency mismatch/price changed |
| 422 | optional semantic validation |
| 429 | rate limited |
| 500 | unexpected server error |
| 503 | dependency temporarily unavailable |

---

# 27. CUSTOMER API

# 27.1 Resolve QR

```text
GET /api/v1/public/tables/resolve/{qr_token}/
```

Response:

```json
{
  "table": {
    "display_name": "Table 05"
  },
  "session": {
    "available_for_ordering": true,
    "public_token": "..."
  }
}
```

Security:

- never expose internal sequential ID if avoidable;
- rate limit;
- no staff information.

# 27.2 Menu

```text
GET /api/v1/public/menu/
```

Optional query:

```text
?category=drinks
```

Response includes:

- id;
- name;
- description;
- current display price;
- image URL;
- availability.

# 27.3 Submit Order

```text
POST /api/v1/public/sessions/{session_token}/orders/
```

Header:

```text
Idempotency-Key: UUID
```

Request:

```json
{
  "items": [
    {
      "menu_item_id": "uuid",
      "quantity": 2,
      "note": "No chili"
    }
  ],
  "customer_note": "..."
}
```

Must ignore/reject:

- price;
- subtotal;
- grand_total;
- status;
- confirmed_by.

Response 201:

```json
{
  "order_code": "ORD-...",
  "status": "WAITING_CASHIER_CONFIRMATION",
  "grand_total": "8.00"
}
```

# 27.4 Order Detail

```text
GET /api/v1/public/sessions/{session_token}/orders/{order_code}/
```

Only same session.

# 27.5 Request Bill

```text
POST /api/v1/public/sessions/{session_token}/request-bill/
```

Idempotent.

---

# 28. CASHIER API

Authentication required.

# 28.1 Pending Orders

```text
GET /api/v1/cashier/orders/?status=WAITING_CASHIER_CONFIRMATION
```

# 28.2 Confirm

```text
POST /api/v1/cashier/orders/{id}/confirm/
```

Body may be empty.

Concurrency:

- transaction;
- `select_for_update`;
- if already confirmed return current canonical state or 409 depending request semantics.

# 28.3 Reject

```text
POST /api/v1/cashier/orders/{id}/reject/
```

```json
{
  "reason": "Customer tidak berada di meja"
}
```

Reason required.

# 28.4 Open Table

```text
POST /api/v1/cashier/tables/{id}/open-session/
```

```json
{
  "guest_count": 4
}
```

# 28.5 Close Table

```text
POST /api/v1/cashier/table-sessions/{id}/close/
```

# 28.6 Complete Payment

```text
POST /api/v1/cashier/table-sessions/{id}/payments/
```

Header idempotency required.

Request:

```json
{
  "method": "CASH",
  "tendered_amount": "20.00"
}
```

Response:

```json
{
  "bill_total": "17.50",
  "tendered_amount": "20.00",
  "change_amount": "2.50",
  "status": "COMPLETED"
}
```

---

# 29. KITCHEN API

# 29.1 Queue

```text
GET /api/v1/kitchen/orders/?states=CONFIRMED,PREPARING,READY
```

# 29.2 Start

```text
POST /api/v1/kitchen/orders/{id}/start/
```

Allowed:

`CONFIRMED -> PREPARING`

# 29.3 Ready

```text
POST /api/v1/kitchen/orders/{id}/ready/
```

Allowed:

`PREPARING -> READY`

# 29.4 Served

Depending restaurant workflow, waiter/cashier/kitchen permission:

```text
POST /api/v1/orders/{id}/served/
```

MVP default:

Cashier atau kitchen role dapat mark served jika operationally needed.

---

# 30. ADMIN API/FUNCTION

- category CRUD;
- menu item CRUD;
- menu availability;
- price change;
- table CRUD;
- QR rotate;
- staff CRUD;
- deactivate user;
- report query;
- audit view.

Price change must create audit event.

---

# 31. ERROR CODE DICTIONARY

Required codes:

```text
AUTH_REQUIRED
AUTH_FORBIDDEN
CSRF_FAILED
INVALID_INPUT
RESOURCE_NOT_FOUND
TABLE_NOT_ACTIVE
TABLE_MAINTENANCE
TABLE_SESSION_NOT_OPEN
TABLE_SESSION_ALREADY_OPEN
TABLE_SESSION_EXPIRED
ORDER_EMPTY
ORDER_TOO_MANY_ITEMS
ORDER_INVALID_STATE
ORDER_ALREADY_CONFIRMED
ORDER_ALREADY_REJECTED
ORDER_ALREADY_CANCELLED
ORDER_PENDING_EXISTS
ORDER_SUBMISSION_RATE_LIMITED
MENU_ITEM_NOT_FOUND
MENU_ITEM_UNAVAILABLE
PRICE_CHANGED
QUANTITY_INVALID
IDEMPOTENCY_KEY_REQUIRED
IDEMPOTENCY_KEY_CONFLICT
PAYMENT_ALREADY_COMPLETED
PAYMENT_AMOUNT_INSUFFICIENT
PAYMENT_INVALID_STATE
BILL_HAS_ACTIVE_ORDERS
WEBSOCKET_AUTH_FAILED
SERVICE_TEMPORARILY_UNAVAILABLE
```

Each error must have:

- stable machine code;
- safe user message;
- log context;
- HTTP status.

---

# 32. FAKE ORDER THREAT MODEL

Fake order cannot dianggap hilang sepenuhnya.

Attack examples:

1. orang memotret QR;
2. membuka QR dari luar restoran;
3. spam pending order;
4. script bot;
5. replay request;
6. mengganti table token;
7. membuat banyak browser sessions;
8. menekan submit berulang;
9. menyimpan URL lama;
10. mencoba direct API.

Layered controls:

1. cashier confirmation gate;
2. active table session;
3. randomized session token;
4. randomized QR token;
5. idempotency key;
6. rate limit;
7. maximum pending per session;
8. stale pending expiration;
9. optional same-LAN policy;
10. audit/security logs;
11. server-side validation;
12. QR token rotation.

Default rule:

Satu table session boleh memiliki **maksimal satu order customer dalam `WAITING_CASHIER_CONFIRMATION`**.

Setelah dikonfirmasi/rejected, customer dapat submit batch berikutnya.

Configurable.

---

# 33. QR SECURITY

QR static token identifies table.

Format:

```text
https://restaurant.example/t/{random-token}
```

Token:

- cryptographically random;
- >= 128-bit entropy recommended;
- non-sequential;
- unique.

QR resolve **tidak otomatis berarti user authorized untuk semua action**.

Ordering requires:

- table active;
- session token;
- server rule;
- rate limit.

Admin can rotate QR token.

Old token immediately invalid after rotation.

---

# 34. TABLE SESSION SECURITY

Saat kasir membuka table:

- generate session UUID/token;
- session state OPEN;
- table becomes OCCUPIED.

Customer browser obtains only public session token after valid QR resolution.

Public token:

- not equal database ID;
- revocable by close;
- not reusable after close;
- scope only to table session.

Optional stricter future mode:

- short-lived customer session token bound to browser cookie.

---

# 35. RATE LIMITING

Minimum rules:

Public QR resolve:

```text
60/min/IP
```

Menu:

```text
120/min/IP
```

Order submit:

```text
5/min/session
10/10min/session
```

Bill request:

```text
3/5min/session
```

Login:

```text
5 failures/15min/account+IP
```

Exact thresholds configurable.

Return 429.

Rate limiting must not block normal shared restaurant NAT excessively. Therefore customer ordering limit should prioritize session token rather than only IP.

---

# 36. IDEMPOTENCY

Every mutation vulnerable to retry must support idempotency.

Mandatory:

- customer submit order;
- payment completion;
- optional open table;
- bill request.

Algorithm:

```text
receive key
calculate request hash
lookup key in scope

if no record:
    process transaction
    store result

if key exists + same hash:
    return stored result

if key exists + different hash:
    409 IDEMPOTENCY_KEY_CONFLICT
```

Client creates UUID once per logical action.

Button retry uses same key.

New cart submission uses new key.

---

# 37. DUPLICATE CLICK FIX

UI:

1. customer clicks Submit;
2. button disabled;
3. spinner;
4. same idempotency key retained until definitive result;
5. if network timeout, show `Status belum diketahui`;
6. client queries order result/idempotency status or retries same key;
7. never generate new key automatically just because timeout.

This handles ambiguous network failure.

---

# 38. NETWORK FAILURE MODEL

Cases:

## A. Request never reaches server

Retry same idempotency key.

## B. Server commits, response lost

Retry same idempotency key -> server returns original order.

## C. Server fails before commit

No order. Retry works.

## D. WebSocket disconnected

UI falls back to polling.

## E. Redis down

Core REST order/payment should still be designed to work if possible.

Real-time update may degrade.

## F. PostgreSQL down

Do not accept order as successful.

Return 503.

## G. Customer offline after menu cached

Menu page may display cached information, but checkout MUST say:

```text
Anda sedang offline.
Pesanan belum dapat dikirim.
Hubungkan kembali internet untuk mengirim pesanan.
```

Never show success offline.

---

# 39. PWA REQUIREMENTS

MUST:

- valid manifest;
- HTTPS production;
- service worker;
- icons;
- installable experience where browser supports;
- responsive;
- offline fallback;
- safe cache strategy;
- update mechanism.

---

# 40. WEB APP MANIFEST

Example:

```json
{
  "name": "Restaurant Ordering",
  "short_name": "Restaurant",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#111111",
  "icons": [
    {
      "src": "/static/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/static/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Brand colors configurable.

---

# 41. SERVICE WORKER CACHE MATRIX

| Resource | Strategy | Reason |
|---|---|---|
| app shell CSS/JS/icons | Cache First + version | stable |
| offline page | Precache | always available |
| menu category static shell | Network First | freshness |
| menu API | Network First with short cached fallback | availability/price change |
| menu image | Stale While Revalidate | bandwidth |
| order submit POST | Network Only | transactional |
| payment POST | Network Only | transactional |
| order status GET | Network First | freshness |
| cashier API | Network Only/Network First | sensitive |
| kitchen API | Network Only/Network First | sensitive |
| admin | Network Only | sensitive |

Never cache authenticated HTML/API indiscriminately.

Never cache payment response in shared cache.

---

# 42. SERVICE WORKER VERSIONING

Cache names:

```text
resto-static-v1
resto-images-v1
resto-menu-v1
```

On activate:

- delete obsolete cache names;
- do not delete current;
- service worker update shown politely.

Critical operations should not be interrupted by forced reload.

---

# 43. OFFLINE UX

Allowed offline:

- app shell;
- logo;
- help;
- cached menu read-only with “data may be outdated”.

Not allowed offline:

- successful order creation;
- cashier confirmation;
- kitchen state mutation;
- payment;
- table open/close.

Banner:

```text
OFFLINE — data mungkin tidak terbaru. Transaksi dinonaktifkan.
```

---

# 44. REAL-TIME DESIGN

Channels groups:

```text
restaurant_{restaurant_id}_cashier
restaurant_{restaurant_id}_kitchen
table_session_{session_id}
order_{order_id}
```

Events:

```text
order.created_pending
order.confirmed
order.rejected
order.preparing
order.ready
order.served
order.completed
bill.requested
payment.completed
table.closed
menu.availability_changed
```

WebSocket payload:

```json
{
  "event": "order.confirmed",
  "version": 1,
  "data": {
    "order_id": "...",
    "order_code": "...",
    "status": "CONFIRMED"
  }
}
```

Never include unnecessary sensitive data.

---

# 45. WEBSOCKET AUTHORIZATION

Customer channel:

- validates table session token;
- only session group.

Staff channel:

- session-authenticated user;
- role permission;
- restaurant scope.

On every connection:

- validate;
- reject inactive user;
- reject closed session.

WebSocket message must not directly modify critical state unless routed through same service-layer validation.

Preferred:

- mutation remains REST POST;
- WebSocket mostly server -> client notification.

---

# 46. FALLBACK POLLING

If WebSocket fails:

Customer:

```text
GET status every 10–15 sec
```

Cashier:

```text
pending queue every 5–10 sec
```

Kitchen:

```text
queue every 5–10 sec
```

Use exponential backoff after repeated failures.

Stop/reduce polling when tab hidden if safe.

---

# 47. CUSTOMER UX SCREENS

1. QR resolving.
2. Table inactive message.
3. Menu.
4. Category navigation.
5. Menu detail modal/page.
6. Cart.
7. Checkout review.
8. Sending state.
9. Pending confirmation.
10. Confirmed.
11. Preparing.
12. Ready.
13. Served.
14. Order history for current session.
15. Request bill.
16. Bill summary.
17. Payment completed/thank you.
18. Session closed.
19. Offline.
20. Error.

---

# 48. CUSTOMER CART RULES

Store cart in browser:

- sessionStorage/localStorage allowed;
- key includes table session token hash/id;
- clear on session close;
- clear after successful submit;
- never treat browser cart as server truth.

Item:

```text
menu_item_id
name display
last_seen_price
quantity
note
```

On submit server revalidates.

---

# 49. CUSTOMER ORDER EDIT RULE

Before submit:

- free edit.

After `WAITING_CASHIER_CONFIRMATION`:

Option MVP:

- customer cannot directly edit submitted order;
- customer may cancel pending order only if enabled.

Default:

- pending cancellation requires cashier to avoid race.

After `CONFIRMED`:

- no customer edit/cancel.

---

# 50. CASHIER DASHBOARD

Widgets:

- active tables;
- pending confirmation count;
- bill requested count;
- unpaid sessions;
- today sales;
- connection indicator.

Pending card:

```text
Order ORD-...
Table 05
Time 13:42
Wait 00:35
2 x Nasi Goreng
1 x Juice
Note: ...

TOTAL $...
[REJECT] [CONFIRM]
```

Confirm button:

- disabled after click;
- transaction-safe;
- handles already-confirmed conflict.

---

# 51. CASHIER VERIFICATION PROCEDURE

Operational flow:

1. customer physically confirms order/table or staff observes presence;
2. cashier opens pending order;
3. verify table label;
4. verify item summary;
5. verify amount;
6. confirm.

PRD does not claim technical mechanism alone proves physical presence.

Cashier confirmation is a human validation gate.

---

# 52. KITCHEN DISPLAY

Columns:

- NEW / CONFIRMED;
- PREPARING;
- READY.

Order card:

- order code;
- table;
- elapsed time;
- items;
- quantity;
- notes;
- status.

Sort:

1. priority override if implemented;
2. confirmed_at ascending.

Kitchen must not see rejected/pending customer orders.

---

# 53. MENU AVAILABILITY RACE CONDITION

Scenario:

- customer sees item available;
- kitchen marks SOLD_OUT;
- customer submits.

Server checks availability at submission.

Result:

`409 MENU_ITEM_UNAVAILABLE`

Response identifies affected items.

Customer cart remains; unavailable item highlighted.

---

# 54. PRICE CHANGE RACE CONDITION

Scenario:

- menu page shows $5;
- admin changes $6;
- customer submits.

Default safe behavior:

- server detects client `last_seen_price` differs;
- return 409 `PRICE_CHANGED`;
- response current price;
- customer must reconfirm.

This avoids surprise price changes.

---

# 55. CONCURRENCY CHALLENGES & FIXES

## Two cashiers confirm same order

Fix:

- transaction;
- row lock;
- state validation.

Expected:

- first succeeds;
- second sees canonical confirmed state/409;
- one history transition only.

## Payment double click

Fix:

- idempotency key;
- table session lock;
- unique completed-payment business constraint.

## Two processes open same table

Fix:

- table row lock;
- unique active session constraint.

## Kitchen double start

Fix:

- row lock;
- state transition validation.

## Close table during active order

Fix:

- session lock;
- query active order states;
- reject close.

---

# 56. SECURITY BASELINE

Django production:

- `DEBUG=False`;
- strong secret key;
- `ALLOWED_HOSTS`;
- secure cookies;
- HTTPS;
- HSTS after verification;
- CSRF middleware;
- session cookie HttpOnly;
- SameSite;
- secure flag production;
- X-Frame-Options;
- content type protection;
- referrer policy;
- CSP SHOULD.

---

# 57. AUTHENTICATION

Staff:

- Django session authentication;
- username/email + password;
- optional PIN future.

Customer:

- anonymous;
- scoped table session token;
- no global account.

Staff session:

- timeout configurable;
- logout;
- invalidated when user deactivated.

---

# 58. PASSWORD SECURITY

Use Django password hashing.

Never:

- plaintext;
- reversible encryption;
- log password.

Admin-created initial password:

- force change recommended.

Login rate limit.

Audit login failures without logging submitted password.

---

# 59. CSRF

All same-origin state-changing staff/customer API endpoints using cookie/session must include CSRF protection.

Frontend fetch:

- obtain CSRF token safely;
- send `X-CSRFToken`;
- `credentials: same-origin`.

Do not solve CSRF by globally adding `csrf_exempt`.

Public anonymous ordering still uses browser session/CSRF where architecture permits.

---

# 60. XSS

User input fields:

- order note;
- menu description admin;
- rejection reason;
- customer note.

Rules:

- Django autoescape remains enabled;
- do not use `safe` on user content;
- sanitize rich text or avoid rich text;
- output text via `textContent` in JS;
- never inject raw note with `innerHTML`.

---

# 61. SQL INJECTION

Use Django ORM.

Raw SQL only when justified.

If raw SQL:

- parameterized;
- never string concatenate user input.

---

# 62. BROKEN ACCESS CONTROL

Every staff endpoint checks:

1. authenticated;
2. active;
3. role/permission;
4. restaurant ownership/scope;
5. object-level state.

Do not rely on hiding button.

---

# 63. IDOR PREVENTION

Even UUIDs do not replace authorization.

Customer order detail requires:

- order belongs to current table session.

Cashier/kitchen requires:

- same restaurant.

---

# 64. MASS ASSIGNMENT

Serializer must explicitly list writable fields.

Customer serializer must not accept:

```text
status
price
grand_total
confirmed_by
restaurant_id
paid_at
```

---

# 65. FILE UPLOAD SECURITY

Menu image:

- validate content type;
- validate extension;
- size limit;
- random filename;
- image dimensions reasonable;
- do not execute upload directory;
- strip dangerous metadata optional.

Suggested max:

5 MB original.

Generate optimized image optional.

---

# 66. SESSION FIXATION / COOKIE

On staff login:

- rotate session key as Django does;
- secure cookie;
- no auth token in URL.

Customer table token may exist in URL from QR, but sensitive staff auth never.

---

# 67. LOGGING

Structured fields:

```text
timestamp
level
request_id
user_id
role
path
method
status_code
duration_ms
event
entity_id
```

Do not log:

- password;
- secret key;
- raw auth cookie;
- full card/banking data (not used);
- unnecessary PII.

---

# 68. REQUEST ID

Middleware generates:

```text
X-Request-ID
```

If trusted upstream supplies valid ID, policy may retain it.

Use request ID in:

- application logs;
- audit event;
- error response;
- debugging.

---

# 69. AUDIT POLICY

Must audit:

- staff login;
- order confirmation/rejection/cancellation;
- payment complete/void;
- table open/close;
- menu price changes;
- user permission changes;
- QR rotation.

Audit append-only through normal UI.

---

# 70. DATA RETENTION

MVP recommended:

- order/payment records retained for thesis/test period;
- audit retained at least same period;
- logs rotated.

Configurable retention.

Do not automatically delete financial history without policy.

---

# 71. BACKUP

PostgreSQL:

- daily logical backup;
- retention 7 daily minimum for prototype;
- weekly copy optional.

Must test restore.

Backup success without restore test is not sufficient.

Runbook:

```text
1. create backup
2. verify file exists and non-zero
3. restore into test database periodically
4. run integrity checks
```

---

# 72. DISASTER RECOVERY

If server lost:

1. provision environment;
2. restore latest DB;
3. restore media;
4. apply migrations;
5. start Redis;
6. start Django;
7. validate health;
8. rotate secrets if compromise suspected.

Targets prototype:

- RPO <= 24h;
- RTO <= several hours.

Can be tightened later.

---

# 73. HEALTH CHECKS

Endpoints:

```text
/health/live
/health/ready
```

Live:

- Django process running.

Ready:

- database reachable;
- optional Redis status.

Do not expose secrets.

---

# 74. OBSERVABILITY

Dashboard/metrics SHOULD include:

- request latency;
- 5xx count;
- DB connectivity;
- Redis connectivity;
- active WebSocket count optional;
- pending order count;
- oldest pending age;
- Celery queue size optional.

For thesis prototype, structured logs + health + admin dashboard acceptable.

---

# 75. PERFORMANCE TARGETS

Normal local/VPS network:

- customer menu first meaningful page: target <= 3 sec;
- API read p95 target <= 500 ms;
- order submit server processing p95 <= 1 sec excluding bad network;
- cashier WebSocket notification target <= 2 sec after commit;
- kitchen notification <= 2 sec after confirm;
- status polling fallback <= configured interval;
- cashier confirm API p95 <= 1 sec.

These are target test metrics, not guaranteed claims.

---

# 76. CAPACITY ASSUMPTION

Prototype target:

- 20–50 tables;
- <= 200 simultaneous browsers;
- <= tens of orders/minute peak.

Single Django deployment with PostgreSQL/Redis is sufficient for thesis-scale load.

Load test higher for margin.

---

# 77. DATABASE INDEX PLAN

Required indexes:

```text
orders(status, created_at)
orders(table_session_id, created_at)
orders(restaurant_id, status, created_at)
table_sessions(table_id, status)
table_sessions(restaurant_id, status)
payments(table_session_id, status)
menu_items(restaurant_id, availability)
menu_items(category_id, sort_order)
order_status_history(order_id, created_at)
audit_events(entity_type, entity_id, created_at)
audit_events(created_at)
```

Use `EXPLAIN` during performance tuning.

Do not over-index every column.

---

# 78. N+1 QUERY PREVENTION

Kitchen/cashier list:

- use `select_related`;
- `prefetch_related` order items.

Tests MAY assert query count on hot paths.

---

# 79. CACHE STRATEGY SERVER

Cache:

- menu list short TTL;
- restaurant settings;
- category list.

Invalidate after admin updates.

Do not cache:

- payment canonical status;
- mutable order state without deliberate invalidation.

---

# 80. CELERY TASKS

Tasks must be idempotent where possible.

## expire_pending_orders

Find pending older than configured TTL.

For each:

- lock order;
- recheck state;
- mark CANCELLED/EXPIRED-like strategy.

Decision:

Keep canonical order statuses simple.

Use:

`CANCELLED` with reason code `PENDING_TIMEOUT`.

Default TTL:

15 minutes configurable.

## cleanup_idempotency_records

Delete expired generic records after safe window.

Payment idempotency records retention longer than order retry window.

---

# 81. NOTIFICATION DESIGN

Browser audio notification:

- cashier new pending;
- kitchen new confirmed.

Must respect browser autoplay restrictions.

UI badge remains primary.

Do not rely solely on sound.

Optional Notification API after user permission.

Push notification WON'T-MVP.

---

# 82. ACCESSIBILITY

Minimum:

- semantic HTML;
- labels;
- keyboard navigation;
- visible focus;
- sufficient contrast;
- no color-only status;
- buttons >= practical touch target;
- ARIA only where needed;
- alt text menu images.

Status:

```text
READY
```

must include text, not just green.

---

# 83. RESPONSIVE DESIGN

Customer target:

- 320px width upward.

Cashier/kitchen:

- tablet/desktop first;
- still usable on phone.

Test:

- Android Chrome;
- iOS Safari basic;
- desktop Chrome/Edge/Firefox.

PWA install behavior varies by browser; core site must remain usable without installation.

---

# 84. INTERNATIONALIZATION

Architecture must support Django i18n.

Default language chosen by restaurant.

Suggested language options future:

- Tetum;
- Portuguese;
- Indonesian;
- English.

MVP may ship one or two languages.

Never hardcode currency formatting in every template.

---

# 85. MENU MANAGEMENT

Admin capabilities:

- create category;
- reorder category;
- create item;
- set image;
- set price;
- available/sold out;
- deactivate;
- edit description.

Deletion policy:

- if historical order references item, deactivate instead of destructive delete.

---

# 86. SOLD OUT FLOW

Admin/kitchen authorized user marks SOLD_OUT.

Server:

1. update availability;
2. invalidate menu cache;
3. broadcast availability event;
4. customer UI refreshes;
5. pending carts revalidated on submit.

---

# 87. REPORTING MVP

Daily report:

- total completed payments;
- gross sales;
- number of paid sessions;
- number of orders;
- rejected orders;
- cancelled orders;
- average order value;
- popular items quantity.

Filters:

- date;
- optional cashier.

All reports derive from canonical database.

---

# 88. REPORT CALCULATION

Revenue:

Use completed payment amounts, not order draft totals.

Order sales analytics:

Use completed/paid sessions only depending metric.

Explicitly label metric.

Avoid ambiguous “revenue today” based on confirmed but unpaid orders.

---

# 89. RECEIPT

Receipt fields:

- restaurant name;
- receipt/payment code;
- table;
- date/time;
- item summaries across valid orders;
- total;
- cash;
- change;
- cashier;
- payment method.

Print:

- browser print sufficient MVP.

Thermal printer direct integration WON'T-MVP.

---

# 90. TAX / SERVICE CHARGE

MVP configuration:

- tax enabled boolean;
- tax percentage decimal;
- service charge optional.

If Timor-Leste restaurant policy does not need automated tax calculation, set zero.

Calculation rule centralized.

Never duplicate formula JS/backend independently without server authority.

---

# 91. DISCOUNT

MVP default:

No customer-entered discount.

Admin/cashier discount optional SHOULD with:

- permission;
- reason;
- type fixed/percentage;
- audit.

If not implemented, `discount_total=0`.

---

# 92. ORDER EXPIRATION

Pending order can expire to prevent stale fake orders.

Config:

```text
PENDING_ORDER_TTL_MINUTES=15
```

Before expiration:

- optional warning.

On expiration:

- state CANCELLED;
- reason code pending timeout;
- notify customer/cashier if connected.

---

# 93. CUSTOMER PRESENCE ENHANCEMENTS

Optional mechanisms:

1. same local Wi-Fi requirement;
2. rotating table session QR;
3. cashier-issued short PIN;
4. NFC future.

MVP default does not require geolocation.

Do not use GPS as reliable indoor presence proof.

---

# 94. OPTIONAL SAME-LAN MODE

If restaurant has local Wi-Fi/server, policy could restrict order POST to expected network.

Caution:

- proxies;
- IPv6;
- mobile data;
- user friction.

Therefore this is optional defense-in-depth, not default core rule.

---

# 95. TECHNICAL CHALLENGE REGISTER

| ID | Challenge | Impact | Solution | Verification |
|---|---|---|---|---|
| TC-001 | Fake order | food waste | cashier gate | unconfirmed not visible kitchen |
| TC-002 | QR shared | spam | active session + rate limit | closed session rejects |
| TC-003 | Submit double click | duplicate | idempotency | one DB order |
| TC-004 | Response lost | ambiguous | retry same key | same result |
| TC-005 | Two cashier confirm | race | transaction + lock | one transition |
| TC-006 | Menu sold out race | invalid order | server revalidate | 409 |
| TC-007 | Price changed | customer dispute | price mismatch confirmation | 409 |
| TC-008 | Offline customer | false success | network-only mutation | no success offline |
| TC-009 | WebSocket down | stale UI | polling fallback | state catches up |
| TC-010 | Redis down | real-time degradation | DB canonical | REST still canonical |
| TC-011 | DB down | data loss | fail closed | 503/no accepted order |
| TC-012 | Cashier forgets | delay | badge/audio/aging | pending visible |
| TC-013 | Kitchen starts twice | state race | row lock | one state history |
| TC-014 | Payment double submit | double payment | idempotency + lock | one payment |
| TC-015 | Close active table | inconsistency | close guards | rejected |
| TC-016 | Client modifies price | fraud | server price | ignored/rejected |
| TC-017 | Client modifies status | access | serializer whitelist | 400/403 |
| TC-018 | ID enumeration | leakage | token + authorization | inaccessible |
| TC-019 | XSS note | compromise | escaping | script not executes |
| TC-020 | CSRF | unauthorized POST | CSRF middleware | 403 |
| TC-021 | SQL injection | DB compromise | ORM/params | tests/static review |
| TC-022 | Broken auth | privilege | role checks | permission tests |
| TC-023 | Weak passwords | takeover | Django validators/rate limit | auth tests |
| TC-024 | Stale PWA cache | wrong menu | network-first menu | freshness tests |
| TC-025 | SW caches API auth | leakage | cache allowlist | cache inspection |
| TC-026 | Browser unsupported PWA install | UX | web fallback | works browser-only |
| TC-027 | Image too large | slow | upload limit/optimization | perf |
| TC-028 | Server restart | disconnect | WS reconnect | reconnect tests |
| TC-029 | Celery duplicates | double mutation | task recheck state | idempotent task |
| TC-030 | Clock/timezone | wrong reports | UTC-aware/Asia Dili display | date tests |
| TC-031 | Float money | rounding | Decimal | unit tests |
| TC-032 | Deleting menu history | audit loss | snapshot/soft delete | history remains |
| TC-033 | Staff deactivated while logged | access | auth check/session policy | denied |
| TC-034 | Brute force login | takeover | throttling | 429/lock delay |
| TC-035 | Log leaks secrets | security | redaction | log review |
| TC-036 | Backup corrupt | recovery | restore drill | restore passes |
| TC-037 | Migration failure | downtime | backup + staged migrate | runbook |
| TC-038 | N+1 queue | slow | prefetch | query count |
| TC-039 | Huge pending queue | cashier overload | TTL + limits | bounded |
| TC-040 | Duplicate table session | inconsistent bill | DB unique/lock | concurrency test |
| TC-041 | Payment before orders served | business mismatch | state guard | 409/config |
| TC-042 | Customer old tab after close | unauthorized | session status check | rejected |
| TC-043 | QR token leaked forever | misuse | rotate QR | old invalid |
| TC-044 | Request replay | duplicate | idem/state | no duplicate |
| TC-045 | Malformed WebSocket event | crash | schema validate | ignore/close |
| TC-046 | User spoof role in request | auth bypass | role server-side | ignored |
| TC-047 | Cached old SW | code mismatch | version/update | reload prompt |
| TC-048 | Browser back restores cart | wrong table | session-scoped cart | isolated |
| TC-049 | Same menu item twice payload | wrong total | normalize/merge or reject | deterministic |
| TC-050 | qty integer overflow/abuse | DOS/cost | max qty | validation |
| TC-051 | Notes huge | storage/XSS | max length | 400 |
| TC-052 | Client changes restaurant ID | cross tenant | server derives scope | denied |
| TC-053 | Kitchen sees pending | fake processing | queryset filter | impossible |
| TC-054 | Payment void destroys history | audit gap | status VOIDED, no delete | retained |
| TC-055 | Admin hard delete user | audit FK break | deactivate/PROTECT/SET_NULL | history valid |
| TC-056 | WebSocket duplicate event | UI duplicate | client state by ID/status | idempotent render |
| TC-057 | Out-of-order WS event | wrong UI | refetch canonical state | correct |
| TC-058 | Cache poisoning | wrong UI | same-origin/versioned caches | controlled |
| TC-059 | Static deploy mismatch | broken app | immutable/versioned static | smoke test |
| TC-060 | DB connection exhaustion | outage | pooling/tuning | load test |

---

# 96. API THROTTLING AND ABUSE TESTS

Test:

- 100 rapid submit requests same session;
- same idempotency key;
- different keys;
- inactive session;
- old QR;
- malformed UUID;
- huge JSON body;
- 1000 items;
- qty 0;
- qty negative;
- qty 999999;
- note 1 MB;
- unauthorized status field.

Expected:

- bounded processing;
- 400/409/429;
- no inconsistent database.

---

# 97. INPUT LIMITS

Recommended:

```text
max order items per order: 30
max quantity per item: 20
max item note: 300 chars
max customer note: 500 chars
max rejection reason: 500 chars
max image: 5 MB
max JSON body: server/proxy reasonable limit
```

Configurable after real restaurant analysis.

---

# 98. VALIDATION ORDER

Submit order:

1. request size;
2. syntax;
3. session token;
4. session active;
5. rate limit;
6. idempotency;
7. item count;
8. item IDs;
9. quantities;
10. menu restaurant scope;
11. availability;
12. price revision;
13. money calculation;
14. transaction persist.

---

# 99. STATE TRANSITION PERMISSIONS MATRIX

| Transition | Customer | Cashier | Kitchen | Admin | System |
|---|---:|---:|---:|---:|---:|
| Draft->Waiting | yes | yes | no | yes | no |
| Waiting->Confirmed | no | yes | no | yes | no |
| Waiting->Rejected | no | yes | no | yes | no |
| Waiting->Cancelled | limited | yes | no | yes | yes timeout |
| Confirmed->Preparing | no | no | yes | yes | no |
| Preparing->Ready | no | no | yes | yes | no |
| Ready->Served | no | yes | yes | yes | no |
| Served->Completed | no | yes/system via payment | no | yes | yes |
| Any->Cancelled | no after confirm | permission | no | yes | restricted |

---

# 100. DATABASE DELETION POLICY

PROTECT historical integrity.

Suggested FK behavior:

- Order -> TableSession: PROTECT;
- OrderItem -> Order: CASCADE only if order itself never UI-deleted;
- OrderItem -> MenuItem: SET_NULL/PROTECT plus snapshot;
- Payment -> TableSession: PROTECT;
- History -> Order: CASCADE technically, but order deletion forbidden;
- Audit actor -> User: SET_NULL to preserve event.

---

# 101. CUSTOM USER MODEL

Must create custom user model **before first migration**.

Example fields:

- id UUID;
- email unique;
- full_name;
- role;
- is_active;
- is_staff.

Set:

```text
AUTH_USER_MODEL=accounts.User
```

Do not switch mid-project after many migrations.

---

# 102. SETTINGS MANAGEMENT

`base.py`

- installed apps;
- middleware;
- templates;
- auth user;
- timezone;
- REST config;
- channels.

`local.py`

- debug true;
- local DB;
- console email.

`test.py`

- deterministic;
- faster hashing optional only testing.

`production.py`

- debug false;
- secure settings;
- env-only secrets.

---

# 103. ENVIRONMENT VARIABLES

`.env.example`:

```text
DJANGO_SETTINGS_MODULE=
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=
DATABASE_URL=
REDIS_URL=
DJANGO_DEBUG=
DJANGO_CSRF_TRUSTED_ORIGINS=
DJANGO_SECURE_SSL_REDIRECT=
RESTAURANT_TIMEZONE=Asia/Dili
RESTAURANT_CURRENCY=USD
PENDING_ORDER_TTL_MINUTES=15
ORDER_MAX_ITEMS=30
ORDER_MAX_QTY_PER_ITEM=20
RATE_LIMIT_ENABLED=true
```

Never commit actual `.env`.

---

# 104. DOCKER SERVICES

```text
web
worker
beat
postgres
redis
nginx
```

Development can omit nginx.

Volumes:

- postgres data;
- media;
- backups optional.

Healthchecks required for DB/Redis/web.

---

# 105. PRODUCTION REQUEST FLOW

```text
Internet/LAN
  |
HTTPS
  |
Nginx
  |
Daphne ASGI
  |
Django
  |--- PostgreSQL
  |--- Redis
```

Nginx must support WebSocket upgrade headers.

---

# 106. TLS

Production public deployment requires HTTPS.

Certificate:

- trusted certificate provider;
- auto renewal.

Service worker production should run secure context.

Localhost development exception accepted by browsers.

---

# 107. STATIC ASSET DEPLOYMENT

Run:

```text
collectstatic
```

Use hashed/static versioning.

Nginx or WhiteNoise serves static.

Media separate.

Do not serve production using Django `runserver`.

---

# 108. DATABASE MIGRATION POLICY

Each schema change:

1. update model;
2. makemigrations;
3. inspect migration;
4. run migration test from empty DB;
5. run migration from previous fixture DB;
6. backup before production migration;
7. migrate;
8. smoke test.

Do not edit applied migrations casually.

---

# 109. SEED DATA

Management command:

```text
python manage.py seed_demo
```

Creates:

- restaurant;
- admin;
- cashier;
- kitchen user;
- 10 tables;
- categories;
- 20 sample menu items.

Passwords printed only safely for local development or supplied env.

Never seed production default password.

---

# 110. DEMO DATA FLOW

Demo for sidang:

1. admin login;
2. show menu/table config;
3. cashier opens Table 05;
4. customer scans QR;
5. customer orders;
6. show pending;
7. prove kitchen has not received;
8. cashier confirms;
9. kitchen instantly receives;
10. kitchen preparing;
11. ready;
12. served;
13. customer request bill;
14. cashier accepts cash;
15. show change;
16. payment complete;
17. close table;
18. show report.

Second demo:

- duplicate click/retry creates one order.

Third demo:

- fake order on closed table rejected.

Fourth demo:

- offline submit blocked.

---

# 111. TEST PYRAMID

## Unit

- calculation;
- validators;
- state machine;
- permissions;
- token generation.

## Service tests

- submit;
- confirm;
- reject;
- prepare;
- ready;
- payment;
- close.

## Integration

- DB transactions;
- row locks;
- API endpoints;
- auth;
- CSRF;
- Redis/Channels.

## E2E

- customer -> cashier -> kitchen -> payment.

## Performance

- load/concurrent requests.

## PWA

- manifest;
- SW registration;
- cache behavior;
- offline.

---

# 112. MONEY TEST CASES

Must cover:

```text
0.10 * 3 = 0.30
2.50 * 2 = 5.00
9.99 * 3 = 29.97
cash 20.00 - bill 17.50 = 2.50
```

No binary float errors.

---

# 113. ORDER CALCULATION TEST

Input browser:

```json
{
  "menu_item_id": "A",
  "quantity": 2,
  "price": "0.01"
}
```

DB price:

```text
3.50
```

Expected:

- browser price ignored/rejected;
- total 7.00.

---

# 114. CONCURRENCY TEST: CONFIRM

Two threads/processes call confirm same order.

Expected:

- exactly one valid state transition;
- one confirmed timestamp;
- one canonical actor;
- no duplicate history confirmation.

Use real transactional PostgreSQL test, not SQLite.

---

# 115. CONCURRENCY TEST: TABLE OPEN

Two cashiers open same AVAILABLE table simultaneously.

Expected:

- one active session;
- one request succeeds;
- one conflict;
- table OCCUPIED.

---

# 116. PAYMENT CONCURRENCY TEST

Two identical payment POSTs.

Same key:

- both receive same payment result;
- one payment row.

Different keys simultaneously:

- session lock/business guard;
- only one completed full payment.

---

# 117. WEBSOCKET TEST

On cashier confirmation:

- kitchen group receives event after commit;
- customer session receives event;
- event contains valid schema;
- unauthorized socket cannot subscribe.

---

# 118. WEBSOCKET FAILURE TEST

Stop Redis/WS.

Expected:

- core DB state still queryable;
- polling UI updates;
- no order/payment loss due only notification outage.

Implementation may return degraded health state.

---

# 119. PWA TEST CASES

1. manifest reachable;
2. icons reachable;
3. service worker registers;
4. static shell cached;
5. offline page works;
6. order POST not served from cache;
7. payment POST not cached;
8. old cache removed after version;
9. menu cache marked stale appropriately;
10. installation optional, web still works.

---

# 120. SECURITY TEST CASES

- customer tries `/cashier/`;
- kitchen tries admin price change;
- customer changes status payload;
- customer accesses another session order;
- CSRF missing on protected POST;
- stored note contains `<script>`;
- SQL-like payload;
- brute login;
- expired session token;
- rotated QR token;
- huge body;
- invalid content type.

---

# 121. ACCEPTANCE CRITERIA — CUSTOMER

AC-CUS-001:
Given table session OPEN, customer dapat membuka menu.

AC-CUS-002:
Given table closed, submit ditolak.

AC-CUS-003:
Customer dapat menambah item valid.

AC-CUS-004:
Sold-out item tidak dapat disubmit.

AC-CUS-005:
Server menghitung total.

AC-CUS-006:
Successful submit menghasilkan WAITING_CASHIER_CONFIRMATION.

AC-CUS-007:
Order pending tidak terlihat kitchen.

AC-CUS-008:
Customer dapat melihat confirm status setelah kasir confirm.

AC-CUS-009:
Offline tidak menghasilkan fake success.

AC-CUS-010:
Duplicate retry same key tidak duplicate.

---

# 122. ACCEPTANCE CRITERIA — CASHIER

AC-CAS-001:
Cashier dapat login.

AC-CAS-002:
Cashier dapat open available table.

AC-CAS-003:
Tidak dapat membuat dua active session.

AC-CAS-004:
Pending order muncul.

AC-CAS-005:
Confirm mengubah state atomically.

AC-CAS-006:
Reject memerlukan reason.

AC-CAS-007:
Cashier melihat bill dari order valid.

AC-CAS-008:
Cash payment menghasilkan change server-side.

AC-CAS-009:
Double payment dicegah.

AC-CAS-010:
Close table hanya saat rule terpenuhi.

---

# 123. ACCEPTANCE CRITERIA — KITCHEN

AC-KIT-001:
Kitchen login.

AC-KIT-002:
Hanya confirmed+ queue muncul.

AC-KIT-003:
Start only from confirmed.

AC-KIT-004:
Ready only from preparing.

AC-KIT-005:
Invalid transition rejected.

AC-KIT-006:
Notes escaped safely.

---

# 124. ACCEPTANCE CRITERIA — ADMIN

- CRUD category;
- CRUD/deactivate menu;
- change price audit;
- sold out update;
- tables;
- QR rotation;
- staff;
- reports;
- audit view.

---

# 125. NON-FUNCTIONAL REQUIREMENTS

NFR-001 Reliability:
critical DB mutation atomic.

NFR-002 Security:
server-authoritative fields.

NFR-003 Performance:
normal operation target latencies.

NFR-004 Usability:
mobile-first customer.

NFR-005 Maintainability:
modular service layer.

NFR-006 Auditability:
critical events logged.

NFR-007 Portability:
Docker deployment.

NFR-008 Resilience:
WS fallback.

NFR-009 Data integrity:
constraints + locking.

NFR-010 Accessibility:
basic WCAG-oriented practices.

---

# 126. DEVELOPMENT PHASE ROADMAP

# PHASE 0 — REQUIREMENT FREEZE

Goal:
freeze terminology/business rules.

Tasks:

- [ ] approve title;
- [ ] approve roles;
- [ ] approve states;
- [ ] approve cashier confirmation;
- [ ] approve cash-only baseline;
- [ ] approve one active session per table;
- [ ] approve pending order limit;
- [ ] approve TTL;
- [ ] approve currency/timezone;
- [ ] copy PRD to repo.

DoD:

- no unresolved MUST business rule.

---

# PHASE 1 — PROJECT BOOTSTRAP

Tasks:

- [ ] create Python virtual environment;
- [ ] initialize Git;
- [ ] install Django 5.2 LTS latest patch;
- [ ] create project;
- [ ] split settings;
- [ ] custom user before first migration;
- [ ] PostgreSQL;
- [ ] Redis;
- [ ] Channels;
- [ ] Celery;
- [ ] pytest;
- [ ] Ruff/Black;
- [ ] `.env.example`;
- [ ] Docker Compose;
- [ ] health endpoint.

DoD:

- app starts;
- DB migration;
- Redis reachable;
- test runs;
- admin login.

---

# PHASE 2 — ACCOUNTS & PERMISSIONS

Tasks:

- [ ] User model;
- [ ] ADMIN/CASHIER/KITCHEN role;
- [ ] login;
- [ ] logout;
- [ ] permission decorators/classes;
- [ ] inactive user handling;
- [ ] login rate limit;
- [ ] security tests.

DoD:

- unauthorized role denied server-side.

---

# PHASE 3 — RESTAURANT & TABLES

Tasks:

- [ ] restaurant model;
- [ ] table model;
- [ ] QR token generator;
- [ ] QR display/print page;
- [ ] table state;
- [ ] table session model;
- [ ] active session constraint;
- [ ] open service;
- [ ] close service;
- [ ] rotate QR;
- [ ] concurrency tests.

DoD:

- impossible to have two active sessions.

---

# PHASE 4 — CATALOG

Tasks:

- [ ] category;
- [ ] menu model;
- [ ] image upload;
- [ ] price Decimal;
- [ ] availability;
- [ ] admin screens;
- [ ] public menu;
- [ ] cache;
- [ ] cache invalidation.

DoD:

- customer reads menu;
- sold-out reflected.

---

# PHASE 5 — CUSTOMER PWA SHELL

Tasks:

- [ ] responsive layout;
- [ ] table resolve screen;
- [ ] menu;
- [ ] cart;
- [ ] manifest;
- [ ] icons;
- [ ] service worker;
- [ ] offline page;
- [ ] network indicator;
- [ ] cache allowlist.

DoD:

- browser web works;
- PWA install possible where supported;
- offline mutation blocked.

---

# PHASE 6 — ORDERING CORE

Tasks:

- [ ] order model;
- [ ] order item snapshot;
- [ ] history;
- [ ] state constants;
- [ ] transition validator;
- [ ] submit service;
- [ ] money calculation;
- [ ] idempotency;
- [ ] validation;
- [ ] rate limit;
- [ ] pending limit;
- [ ] tests.

DoD:

- one correct pending order created;
- duplicate retry safe.

---

# PHASE 7 — CASHIER CONFIRMATION

Tasks:

- [ ] pending selector;
- [ ] cashier UI;
- [ ] confirm service;
- [ ] reject service;
- [ ] row lock;
- [ ] audit;
- [ ] aging indicator;
- [ ] conflict UI.

DoD:

- fake/unconfirmed never kitchen.

---

# PHASE 8 — REAL-TIME

Tasks:

- [ ] ASGI routing;
- [ ] Redis channel layer;
- [ ] staff consumers;
- [ ] customer consumer;
- [ ] event schema;
- [ ] reconnect;
- [ ] fallback polling;
- [ ] authorization tests.

DoD:

- status sync and fallback work.

---

# PHASE 9 — KITCHEN

Tasks:

- [ ] queue;
- [ ] confirm filter;
- [ ] start;
- [ ] ready;
- [ ] served;
- [ ] elapsed time;
- [ ] notes;
- [ ] race tests.

DoD:

- kitchen lifecycle reliable.

---

# PHASE 10 — BILL & PAYMENT

Tasks:

- [ ] bill calculation selector;
- [ ] request bill;
- [ ] cashier bill page;
- [ ] payment model;
- [ ] cash tender;
- [ ] change;
- [ ] idempotent payment;
- [ ] session lock;
- [ ] receipt;
- [ ] close table integration.

DoD:

- double payment impossible;
- accurate money.

---

# PHASE 11 — AUDIT & REPORTING

Tasks:

- [ ] audit service;
- [ ] event list;
- [ ] daily revenue;
- [ ] order stats;
- [ ] rejection/cancel stats;
- [ ] popular item;
- [ ] date/timezone tests.

DoD:

- report matches manual calculation dataset.

---

# PHASE 12 — BACKGROUND TASKS

Tasks:

- [ ] Celery config;
- [ ] expire pending;
- [ ] beat schedule;
- [ ] cleanup idempotency;
- [ ] retry policy;
- [ ] task idempotency tests.

DoD:

- stale orders cancelled safely.

---

# PHASE 13 — SECURITY HARDENING

Checklist:

- [ ] DEBUG false production;
- [ ] secure cookies;
- [ ] CSRF;
- [ ] role tests;
- [ ] object auth;
- [ ] XSS tests;
- [ ] input limits;
- [ ] upload validation;
- [ ] headers;
- [ ] rate limits;
- [ ] secret scan;
- [ ] audit;
- [ ] dependency updates.

---

# PHASE 14 — PERFORMANCE

Tasks:

- [ ] query profiling;
- [ ] indexes;
- [ ] prefetch;
- [ ] load test;
- [ ] WebSocket load basic;
- [ ] image optimization;
- [ ] caching.

DoD:

- target p95 acceptable in test environment.

---

# PHASE 15 — DEPLOYMENT

Tasks:

- [ ] production Docker;
- [ ] Nginx;
- [ ] TLS;
- [ ] Daphne;
- [ ] worker;
- [ ] PostgreSQL volume;
- [ ] Redis;
- [ ] static/media;
- [ ] health;
- [ ] backup;
- [ ] restore test;
- [ ] logs.

---

# PHASE 16 — END-TO-END QA

Run complete scenarios:

- [ ] happy path;
- [ ] reject fake;
- [ ] duplicate submit;
- [ ] two cashier race;
- [ ] sold out race;
- [ ] price change;
- [ ] WS down;
- [ ] offline;
- [ ] DB unavailable;
- [ ] double payment;
- [ ] closed session;
- [ ] QR rotated;
- [ ] session timeout.

---

# PHASE 17 — THESIS EXPERIMENT

Collect:

- order response time;
- confirmation delivery time;
- duplicate prevention results;
- fake order workflow result;
- functional success rate;
- SUS questionnaire;
- browser/device test;
- concurrency test result.

---

# 127. ISSUE-TO-TEST TRACEABILITY

Every TC issue must map to at least one test ID.

Example:

```text
TC-003 -> TEST-IDEMP-001, E2E-005
TC-005 -> TEST-CONCUR-001
TC-008 -> PWA-OFFLINE-003
TC-014 -> TEST-PAY-007
```

Create `docs/test-matrix.md`.

---

# 128. SUGGESTED TEST IDS

```text
UNIT-MONEY-001
UNIT-STATE-001
API-CUSTOMER-001
API-CASHIER-001
API-KITCHEN-001
AUTH-RBAC-001
SEC-CSRF-001
SEC-XSS-001
IDEMP-ORDER-001
IDEMP-PAY-001
CONCUR-CONFIRM-001
CONCUR-TABLE-001
CONCUR-PAY-001
WS-AUTH-001
WS-FALLBACK-001
PWA-CACHE-001
PWA-OFFLINE-001
E2E-HAPPY-001
E2E-FAKE-001
E2E-NETWORK-001
```

---

# 129. END-TO-END HAPPY PATH SPEC

Precondition:

- Table 05 AVAILABLE;
- Burger AVAILABLE $5;
- Juice AVAILABLE $2.

Steps:

1. cashier open Table 05;
2. table OCCUPIED;
3. session OPEN;
4. customer resolves QR;
5. customer adds 2 Burger, 1 Juice;
6. browser estimate $12;
7. submit with idempotency key;
8. server confirms $12;
9. order pending;
10. kitchen query must not contain order;
11. cashier confirm;
12. kitchen receives;
13. kitchen start;
14. ready;
15. served;
16. request bill;
17. bill $12;
18. cash $20;
19. change $8;
20. payment completed;
21. session paid;
22. order completed according workflow;
23. close;
24. table available/cleaning;
25. report +$12.

---

# 130. FAKE ORDER TEST SPEC

Case A: closed table.

- attacker knows QR;
- no active session;
- POST impossible/403/409 domain response;
- no order.

Case B: active table but attacker submits.

- pending created at worst;
- kitchen does not see;
- cashier rejects;
- no food processing;
- audit exists.

Case C: spam.

- pending limit/rate limit stops flood.

This demonstrates mitigation, not mathematical elimination.

---

# 131. NETWORK TIMEOUT TEST

Inject delay after DB commit but before response.

Client sees timeout.

Client retries with same idempotency key.

Expected:

- one order;
- response references original.

This is important dissertation-quality reliability test.

---

# 132. PRICE MANIPULATION TEST

Intercept request and add:

```json
{
  "price": "0.01",
  "grand_total": "0.01"
}
```

Expected:

- fields rejected or ignored;
- canonical price applied;
- audit/security log optional.

---

# 133. OUT-OF-ORDER WEBSOCKET TEST

Client receives:

1. READY event;
2. delayed PREPARING event.

Client MUST NOT blindly regress display.

Strategy:

- event includes status/version/timestamp;
- if unexpected/regressive, client refetches canonical order.

Database remains truth.

---

# 134. EVENT VERSIONING

Each event:

```json
{
  "event": "...",
  "version": 1,
  "occurred_at": "...",
  "entity_version": 7,
  "data": {}
}
```

Optional `entity_version` integer on order can support ordering.

MVP may use `updated_at` + refetch on conflict.

---

# 135. OPTIMISTIC UI POLICY

Do not optimistically display critical final states.

Allowed:

- cart local changes.

Not allowed before server response:

- Order Confirmed;
- Payment Completed;
- Table Closed.

---

# 136. ERROR UX

Never show raw:

```text
IntegrityError
KeyError
Traceback
```

User:

```text
Pesanan belum dapat diproses. Silakan coba kembali.
Kode: ORDER-...
```

Developer log includes request ID and exception.

---

# 137. RETRY POLICY

GET:

- safe retry.

POST critical:

- retry only with idempotency key.

WebSocket:

- exponential reconnect:
  1s, 2s, 5s, 10s, max 30s.

Celery:

- retry transient errors only;
- never blindly retry business validation.

---

# 138. DATABASE DEADLOCK HANDLING

Keep transactions:

- short;
- consistent locking order;
- no network calls inside transaction.

Lock order convention:

```text
Table -> TableSession -> Order -> Payment
```

Do not publish WebSocket inside uncommitted transaction.

Transient deadlock may be retried carefully at service boundary if idempotent.

---

# 139. TRANSACTION CALLBACK

Use post-commit mechanism for notifications.

Pattern:

```text
transaction.atomic:
    mutate DB
    register on_commit publish event
```

Avoid kitchen receiving event for transaction that later rolls back.

---

# 140. ORDER SNAPSHOT RULE

OrderItem stores:

- name at order;
- unit price at order;
- SKU optional.

If admin later renames Burger to Cheeseburger, historical receipt remains original snapshot.

---

# 141. PRIVACY

MVP customer account not needed.

Avoid collecting:

- phone;
- email;
- identity;

unless restaurant explicitly requires.

This reduces privacy risk.

Staff information access restricted.

---

# 142. QR PRINTING

Admin page:

- select table;
- show table display;
- QR;
- short instruction.

Example:

```text
TABLE 05
Scan to view menu and order
```

QR file can be generated server-side or library.

Regeneration after token rotation.

---

# 143. SESSION OPEN UX

Cashier table grid:

```text
01 AVAILABLE
02 OCCUPIED
03 AVAILABLE
04 MAINTENANCE
```

Click AVAILABLE:

- guest count optional;
- Open Table confirm modal.

If race:

- UI shows “meja sudah dibuka oleh proses lain”.

---

# 144. TABLE CLOSE UX

Before close show:

- active orders;
- bill total;
- payment status.

If invalid:

```text
Tidak dapat menutup meja:
- pembayaran belum selesai
```

Admin override requires:

- permission;
- reason;
- audit.

---

# 145. KITCHEN AGING

Card age:

```text
00:03
00:10
00:25
```

Thresholds configurable.

Use text/icon in addition to color.

---

# 146. CASHIER AGING

Pending order age highlighted.

Reason:

Cashier confirmation gate introduces potential latency.

Metric:

- median confirmation time;
- p95 confirmation time.

Useful for thesis evaluation.

---

# 147. THESIS METRICS

Suggested quantitative metrics:

1. QR-to-menu load time.
2. Order submit response time.
3. Pending-to-cashier notification delay.
4. Confirm-to-kitchen notification delay.
5. Duplicate prevention success rate.
6. Invalid/fake order blocked from kitchen rate.
7. Correct transaction calculation rate.
8. Concurrency consistency rate.
9. Functional test pass rate.
10. SUS score.

Do not claim reduction in real restaurant errors without empirical comparison.

---

# 148. SUS

Use standard System Usability Scale methodology if approved by supervisor.

Participants can include:

- customer testers;
- cashier;
- kitchen/staff.

Report:

- respondent count;
- method;
- calculated score;
- limitations.

---

# 149. LIMITATIONS TO DECLARE

- cashier confirmation still depends on human action;
- fake order can still create pending noise before rejection under certain conditions;
- no payment gateway;
- PWA support differs by browser;
- offline transactions not finalized;
- internet/local network availability matters;
- prototype scale single restaurant;
- results may not generalize to all restaurants.

---

# 150. FUTURE DEVELOPMENT

- kitchen printer;
- waiter role;
- split bill;
- partial payment;
- payment gateway;
- local bank integration if available;
- loyalty;
- customer accounts;
- reservation;
- inventory recipe;
- multi-branch;
- push notification;
- offline-first queued order with reconciliation;
- dynamic QR;
- table PIN;
- local kiosk;
- analytics;
- tax integrations;
- cloud replication.

---

# 151. AI AGENT FILE-BY-FILE IMPLEMENTATION ORDER

Agent must not implement everything in random order.

Order:

```text
1 config/settings
2 accounts/models
3 restaurants/models
4 tables/models
5 catalog/models
6 ordering/models
7 payments/models
8 migrations
9 core validators
10 table services
11 catalog selectors
12 order services
13 payment services
14 API serializers
15 API views
16 URL routes
17 templates
18 customer JS
19 cashier UI
20 kitchen UI
21 Channels
22 PWA service worker
23 Celery
24 reporting
25 Docker
26 Nginx
27 tests hardening
28 docs
```

---

# 152. AI AGENT TASK TEMPLATE

Every task ticket should include:

```text
TASK-ID:
Title:
PRD references:
Goal:
Inputs:
Files allowed:
Files prohibited:
Business rules:
Database constraints:
API contract:
Expected errors:
Tests required:
Acceptance criteria:
Migration required: yes/no
Security review:
Done when:
```

---

# 153. EXAMPLE TASK

```text
TASK-ID: ORD-006

Title:
Implement cashier confirm order service

PRD:
11.3, 23.3, 28.2, 55

Goal:
Safely transition pending order to confirmed.

Inputs:
order_id, cashier_user

Rules:
- user role CASHIER/ADMIN
- order same restaurant
- state must WAITING_CASHIER_CONFIRMATION
- lock row
- set confirmed fields
- add history
- audit
- publish after commit

Tests:
- success
- wrong role
- wrong state
- concurrent confirmation
- order missing

Done:
all tests pass.
```

---

# 154. DEFINITION OF DONE PER FEATURE

Feature is not done unless:

- requirement implemented;
- migration reviewed;
- unit test;
- integration test;
- permission test;
- negative test;
- UI error state;
- logs sensible;
- documentation;
- no secrets;
- code formatted;
- full suite green.

---

# 155. CODE REVIEW CHECKLIST

- Is business logic in service layer?
- Is money Decimal?
- Is DB mutation atomic?
- Does it need row lock?
- Does it need idempotency?
- Are permissions checked?
- Can customer control server-owned fields?
- Is resource scoped to restaurant/session?
- Is input bounded?
- Is XSS safe?
- Is CSRF active?
- Is notification after commit?
- Is cache safe?
- Is audit needed?
- Are tests concurrent where necessary?
- Are error codes stable?

---

# 156. RELEASE CHECKLIST

Before demo/production:

- [ ] migrate;
- [ ] collectstatic;
- [ ] create superuser securely;
- [ ] seed real restaurant config;
- [ ] generate table QR;
- [ ] TLS;
- [ ] debug false;
- [ ] hosts;
- [ ] CSRF trusted origin;
- [ ] secure cookies;
- [ ] Redis;
- [ ] Celery;
- [ ] health;
- [ ] backup;
- [ ] restore test;
- [ ] all tests;
- [ ] E2E;
- [ ] device test;
- [ ] QR print test;
- [ ] cash flow test;
- [ ] offline test;
- [ ] duplicate test.

---

# 157. RUNBOOK — REDIS DOWN

Symptoms:

- WebSocket fails;
- notification delayed.

Action:

1. verify Redis health;
2. restart Redis;
3. verify channel layer;
4. clients reconnect;
5. verify DB state.

Do not modify DB order manually solely because UI stale.

Use REST/admin to inspect canonical state.

---

# 158. RUNBOOK — DATABASE DOWN

Action:

1. mark system unavailable;
2. do not display transaction success;
3. restore DB connectivity;
4. run health;
5. inspect error period;
6. clients retry idempotent actions.

No fake “offline accepted” behavior MVP.

---

# 159. RUNBOOK — STUCK ORDER

Admin inspects:

- current status;
- history;
- timestamps;
- table session;
- user actors.

Manual override:

- permission;
- reason;
- audit.

Never edit DB directly during normal operation.

---

# 160. RUNBOOK — WRONG PRICE

If menu configured wrong after orders:

- correct menu future price;
- historical snapshots preserved;
- current pending handling follows operational policy;
- adjustments require staff reason/audit if implemented.

Do not retroactively overwrite historical order item unit prices.

---

# 161. RUNBOOK — LOST QR

Rotate table QR.

Steps:

1. admin select table;
2. rotate token;
3. old URL invalid;
4. regenerate print;
5. replace physical QR.

Active table session handling must be explicit.

Recommended:

QR rotate does not automatically close active session unless security incident.

---

# 162. LOG ROTATION

Production:

- stdout collected by Docker/system;
- rotate;
- disk size limits.

Audit stored DB separately from general logs.

---

# 163. BACKUP SCHEDULE

Prototype example:

```text
02:00 Asia/Dili daily pg_dump
keep 7 daily
keep 4 weekly optional
```

Do not perform heavy backup during peak restaurant hours.

---

# 164. SECURITY UPDATE POLICY

Monthly or before major demo:

- check Django security patch;
- update dependency patch;
- run tests;
- deploy.

Critical security advisory:

- prioritize.

---

# 165. DEPENDENCY POLICY

Avoid unnecessary package explosion.

Every dependency needs:

- purpose;
- maintained;
- compatible;
- license acceptable;
- security review;
- pinned version.

Prefer Django built-ins where sufficient.

---

# 166. OPENAPI / API DOCUMENTATION

Generate machine-readable API documentation SHOULD.

Each endpoint documents:

- method;
- path;
- auth;
- role;
- body;
- response;
- errors;
- idempotency;
- state precondition;
- examples.

This improves execution by AI agents.

---

# 167. FRONTEND JS MODULES

Suggested:

```text
static/js/
  api.js
  csrf.js
  network.js
  websocket.js
  pwa.js
  customer/
    menu.js
    cart.js
    order.js
    status.js
  cashier/
    dashboard.js
    confirmation.js
    payment.js
  kitchen/
    queue.js
```

Avoid one 3000-line `app.js`.

---

# 168. API CLIENT

Central `api.js` handles:

- base URL;
- CSRF;
- JSON;
- request ID;
- common error parsing;
- timeout;
- safe retry GET only.

Mutation caller supplies idempotency key.

---

# 169. CART STORAGE KEY

Example:

```text
resto_cart:{session_public_id}
```

Do not mix cart between Table 02 and Table 05.

On session invalid:

- purge associated cart.

---

# 170. CLIENT STATE RECOVERY

On page refresh:

1. resolve session;
2. load canonical active orders;
3. restore cart draft if session same;
4. connect WebSocket;
5. render server state.

Do not rely only on in-memory JS.

---

# 171. DATABASE SOURCE-OF-TRUTH HIERARCHY

1. PostgreSQL canonical records.
2. Server services.
3. REST representation.
4. WebSocket notification.
5. Browser local state.
6. PWA cache.

If conflict, higher layer wins.

---

# 172. FAILURE PRINCIPLE

For financial/ordering mutations:

**fail closed**.

If uncertain whether server can persist safely:

- do not tell user “success”.

Ambiguous timeout:

- say status uncertain;
- resolve by idempotent retry/read.

---

# 173. BILL COMPOSITION

Bill includes orders associated with session where business status is billable.

Recommended:

Include:

- CONFIRMED;
- PREPARING;
- READY;
- SERVED;
- COMPLETED.

Exclude:

- REJECTED;
- CANCELLED.

But payment normally requested when serving sufficiently complete.

Exact gate:

Default payment allowed when no order is `WAITING_CASHIER_CONFIRMATION`.

Restaurant may allow paying while preparing.

Do not force “all served” if business wants pay-first later; use config.

For MVP dine-in pay-after-meal, require no active preparation before close, not necessarily before payment.

---

# 174. SESSION BILL TOTAL

Do not store only a mutable magic total without derivation.

Selector:

```text
sum valid order grand_total
```

Optional cached snapshot at payment time stored in payment/receipt.

Payment uses locked/recalculated bill.

---

# 175. PAYMENT RECEIPT IMMUTABILITY

Once payment COMPLETED:

- amount;
- bill snapshot;
- received_by;
- paid_at;

should not be silently edited.

Void:

- separate state/action;
- reason;
- actor;
- audit.

---

# 176. DATA EXPORT

Admin SHOULD export report CSV.

Protect spreadsheet formula injection:

If text starts with:

```text
=
+
-
@
```

escape appropriately in exported CSV.

---

# 177. ADMIN SECURITY

Django admin may be enabled for technical admin.

Operational UI should use custom role-aware pages.

Admin path:

- not treated as sole security via obscurity;
- strong auth required.

---

# 178. CACHING AUTHENTICATED PAGES

Service worker must bypass caching for:

```text
/cashier/
/kitchen/
/admin/
/api/v1/cashier/
/api/v1/kitchen/
/api/v1/admin/
```

unless explicitly safe.

---

# 179. SERVICE WORKER FETCH RULE ORDER

Pseudo:

```text
if request.method != GET:
    network

if sensitive path:
    network

if static asset:
    cache-first

if menu image:
    stale-while-revalidate

if menu data:
    network-first

else:
    network-first with offline fallback where safe
```

---

# 180. PWA UPDATE UX

When new SW waiting:

Show:

```text
Versi baru tersedia.
[Perbarui]
```

Do not force reload during:

- payment modal;
- pending POST;
- critical form.

---

# 181. BROWSER STORAGE SECURITY

Do not store:

- staff password;
- session cookie manually;
- secrets.

Customer session identifier in browser storage/cookie only as necessary.

Prefer secure server session cookies for staff.

---

# 182. REALTIME RECONNECT UX

Cashier/kitchen header shows:

```text
Live
Reconnecting
Polling mode
Offline
```

Staff must know if realtime degraded.

---

# 183. SERVER-SIDE EVENT PUBLISH

Publish function must be tolerant.

If notification publish fails after DB commit:

- log error;
- canonical DB remains committed;
- fallback polling recovers.

Do not rollback successful payment solely because WebSocket push failed.

---

# 184. EVENTUAL UI CONSISTENCY

Real-time is best effort.

UI periodically resync:

- cashier queue every e.g. 60s even with WS;
- kitchen queue periodically;
- customer refetch on focus.

This repairs missed events.

---

# 185. ADMIN CONFIG TABLE

Suggested restaurant settings:

```text
pending_order_ttl_minutes
max_pending_orders_per_session
max_order_items
max_qty_per_item
tax_percent
service_charge_percent
require_all_orders_served_before_close
table_cleaning_state_enabled
customer_bill_request_enabled
```

Validated values.

Avoid environment-only for business settings that admin should change.

---

# 186. FEATURE FLAGS

Optional table:

```text
feature_flags
```

MVP may use Django settings.

Do not add complex flag system unless needed.

---

# 187. DATABASE CHECK CONSTRAINTS

Examples:

```text
menu price >= 0
order subtotal >= 0
grand total >= 0
payment amount >= 0
quantity > 0
capacity > 0
guest_count > 0
```

Business state checks still service-layer.

---

# 188. UNIQUE CONSTRAINTS

- user email;
- table code per restaurant;
- qr token;
- session public token;
- order code;
- payment code;
- order idempotency key scoped to session;
- payment idempotency key scoped appropriately;
- only one active table session via partial unique rule.

---

# 189. LOCKING RULES

Use row lock only where mutation race matters.

Do not lock large querysets unnecessarily.

Always execute inside `transaction.atomic()`.

Concurrency test on PostgreSQL.

---

# 190. API PAGINATION

Staff list endpoints:

- page size default 50;
- max 100.

Kitchen active queue may return bounded active data.

Reports paginated/exportable.

Public menu typically unpaginated if small; category grouping.

---

# 191. SORTING

Kitchen:

`confirmed_at ASC`.

Pending cashier:

`submitted_at ASC`.

Menu:

`category.sort_order`, `menu.sort_order`, name fallback.

Audit:

`created_at DESC`.

---

# 192. SEARCH

Admin:

- menu name/SKU;
- order code;
- payment code;
- table code.

Avoid exposing arbitrary expensive search query.

---

# 193. DATABASE SERIALIZATION

API Decimal as string:

```json
"12.50"
```

not binary float.

Dates ISO 8601.

IDs string UUID.

---

# 194. RESPONSE FIELD POLICY

Order public response:

Allowed:

- order code;
- status;
- items;
- amounts;
- times relevant.

Do not expose:

- cashier email;
- internal audit;
- internal DB metadata.

---

# 195. CORS

Preferred architecture same-origin.

No broad:

```text
Access-Control-Allow-Origin: *
```

for authenticated staff APIs.

If no cross-origin frontend, do not add CORS complexity.

---

# 196. CSP

SHOULD configure Content Security Policy.

Avoid inline JS where possible.

If inline scripts needed, nonce/hash policy.

Third-party CDNs avoided production if local asset hosting simple.

---

# 197. THIRD-PARTY DEPENDENCY OUTAGE

Prefer local CSS/JS assets rather than CDN so restaurant continues if external CDN unavailable.

Menu images local/object storage controlled.

---

# 198. LOCAL NETWORK DEPLOYMENT OPTION

Can deploy on:

- local restaurant server;
- local Wi-Fi;
- optional public domain.

Advantages:

- less dependency upstream internet.

Tradeoffs:

- local device maintenance;
- TLS/domain complexity;
- backup off-device needed.

Architecture does not assume cloud-only.

---

# 199. PUBLIC VPS DEPLOYMENT OPTION

Advantages:

- easier domain/TLS;
- remote access/admin.

Tradeoffs:

- internet dependency;
- recurring cost.

Choose based on thesis infrastructure.

---

# 200. RECOMMENDED THESIS + PRODUCTION DEPLOYMENT

Baseline adalah **Local Edge Production Node** pada satu host Linux di restoran yang terhubung kabel LAN ke router/switch.

Service inti:

- Nginx reverse proxy + TLS;
- minimal dua instance Django/Daphne;
- Celery worker;
- exactly-one Celery Beat;
- PostgreSQL 18.4+;
- Redis Realtime;
- Redis Jobs;
- health checks;
- metrics/alerting;
- encrypted local + off-site backup.

Internet WAN **bukan dependency transaksi inti**. Customer, cashier, dan kitchen tetap memakai server lokal selama LAN/local-edge sehat. Cloud/VPS tetap dapat dipakai sebagai deployment alternatif, tetapi tidak boleh disebut setara dengan local-edge resilience ketika seluruh backend bergantung pada ISP.

---

# 201. CI PIPELINE

On push/PR:

1. install deps;
2. lint;
3. migration check;
4. unit tests;
5. integration tests;
6. coverage;
7. optional build Docker.

Before release:

- E2E;
- security config check.

---

# 202. DJANGO SYSTEM CHECK

Production deploy should run:

```text
python manage.py check --deploy
```

Review warnings.

---

# 203. MIGRATION DRIFT CHECK

CI:

```text
python manage.py makemigrations --check --dry-run
```

Fail if model changes lack migration.

---

# 204. TEST DATABASE

Use PostgreSQL for integration/concurrency.

SQLite may be used for isolated lightweight unit tests only if behavior doesn't depend on DB feature, but default test environment should mirror PostgreSQL.

---

# 205. FACTORY DATA

Factories:

- UserFactory;
- RestaurantFactory;
- TableFactory;
- TableSessionFactory;
- CategoryFactory;
- MenuItemFactory;
- OrderFactory;
- OrderItemFactory;
- PaymentFactory.

Avoid brittle giant fixtures.

---

# 206. PERFORMANCE TEST SCENARIOS

1. 100 customers load menu.
2. 50 simultaneous order submissions across sessions.
3. 10 cashiers/dashboard clients.
4. kitchen with 100 active orders.
5. report on 100k historical order items synthetic.

Observe:

- p50/p95;
- DB CPU;
- query count;
- error rate.

---

# 207. DATA VOLUME PLAN

Prototype estimated:

```text
100 orders/day
365 = 36,500/year
~3 items/order = ~109,500 order items/year
```

PostgreSQL handles easily with indexes.

No sharding/microservice required.

---

# 208. SECURITY EVENT EXAMPLES

Log:

```text
RATE_LIMIT_HIT
INVALID_SESSION_TOKEN
IDEMPOTENCY_CONFLICT
ROLE_FORBIDDEN
REPEATED_LOGIN_FAILURE
QR_RESOLVE_ABUSE
```

Do not automatically accuse user; event is technical indicator.

---

# 209. FRAUD / ABUSE ADMIN VIEW

COULD show:

- rejected orders count;
- repeated pending timeout;
- rate-limit hits;
- QR token abuse.

Not required for MVP.

---

# 210. CUSTOMER UI COPY

Pending:

```text
Pesanan sudah diterima sistem dan sedang menunggu konfirmasi kasir.
Pesanan belum dikirim ke dapur.
```

Confirmed:

```text
Pesanan telah dikonfirmasi dan dikirim ke dapur.
```

Offline:

```text
Koneksi terputus. Pesanan tidak akan dikirim sampai koneksi tersedia.
```

Rejected:

```text
Pesanan tidak dikonfirmasi oleh kasir.
Silakan hubungi kasir jika membutuhkan bantuan.
```

---

# 211. CASHIER UI COPY

Conflict:

```text
Order sudah diproses oleh pengguna lain.
Data telah diperbarui.
```

Payment conflict:

```text
Pembayaran untuk meja ini sudah tercatat.
Periksa transaksi sebelum mencoba kembali.
```

---

# 212. KITCHEN UI COPY

If stale update:

```text
Status order telah berubah. Daftar diperbarui.
```

Do not allow force update through stale UI.

---

# 213. CUSTOMER QR EDGE CASE

QR table valid but no active session.

Options:

A. Show “silakan hubungi kasir untuk membuka meja”.
B. Auto-create provisional session.

Decision MVP:

**A**.

Reason:
cashier maintains physical occupancy control and fake-order mitigation.

---

# 214. WALK-IN WITHOUT SMARTPHONE

Cashier can create manual order on same table session.

Source:

`CASHIER`.

Manual order may be directly `CONFIRMED` if cashier is authorized and is the verifier.

History records source.

---

# 215. MULTIPLE CUSTOMERS SAME TABLE

Supported.

All share table session.

They may submit multiple order batches.

Pending limit applies per session.

Bill aggregates all.

If separate bill required, WON'T-MVP.

---

# 216. CUSTOMER DEVICE LOSS

Because no customer identity required:

- another device can resolve active QR/session and see limited session order data if policy allows.

Privacy choice:

MVP order details are table-scoped.

If privacy concerns later, issue browser-specific guest token.

---

# 217. SESSION DATA EXPOSURE

Do not show historical customers.

Only active session.

After close:

public session token should no longer return order details except optional short receipt page if deliberately designed.

Default:

closed public token returns session closed and minimal data.

---

# 218. ORDER CODE GENERATION

Must be human-readable and unique.

Example:

```text
ORD-260813-A7K4
```

Do not derive security from order code.

DB UUID remains internal.

---

# 219. PAYMENT CODE

Example:

```text
PAY-260813-K92M
```

Unique.

Receipt uses it.

---

# 220. AUDIT BEFORE/AFTER DATA

Do not dump sensitive whole model automatically.

Store selected fields.

Price change:

```json
{
  "before": {"price": "5.00"},
  "after": {"price": "6.00"}
}
```

---

# 221. API SCHEMA STABILITY

Version in URL `/v1/`.

Breaking changes create v2 or coordinated update.

For thesis, keep v1 stable after integration begins.

---

# 222. FEATURE FREEZE

Before final testing:

- no schema redesign;
- only bug fixes;
- security fixes;
- documentation.

This protects thesis result reproducibility.

---

# 223. THESIS TEST DATASET

Create controlled menu:

- 4 categories;
- 20 items;
- price variations;
- sold out cases.

Tables:

- 10.

Users:

- 1 admin;
- 2 cashier;
- 2 kitchen.

Test orders:

- at least 100 automated scenario records;
- concurrency repetitions multiple runs.

---

# 224. EXPERIMENT: FAKE ORDER MITIGATION

Measure:

Scenario without cashier gate conceptual baseline:
order immediately kitchen-visible.

Implemented system:
pending unconfirmed not kitchen-visible.

Test N attempts:

- invalid closed session;
- valid active but rejected;
- spam.

Metric:

```text
kitchen_processed_unverified_orders / unverified_attempts
```

Expected under designed workflow:

0 during controlled tests.

Do not generalize beyond tested controls.

---

# 225. EXPERIMENT: DUPLICATE PREVENTION

Send same logical request e.g. 100 retries using same key.

Measure:

- number request;
- number order rows;
- number response resource IDs.

Expected:

- one logical order row/resource.

---

# 226. EXPERIMENT: CONCURRENT CONFIRM

Run two confirm calls near-simultaneously repeatedly.

Measure:

- invalid duplicate transitions;
- history count;
- final state.

Expected:

- no duplicated transition corruption.

---

# 227. EXPERIMENT: NETWORK DEGRADATION

Simulate:

- latency;
- dropped response;
- WebSocket loss.

Observe:

- no false success;
- idempotent recovery;
- polling recovery.

---

# 228. EXPERIMENT: USABILITY

Tasks:

Customer:
- open menu;
- add;
- submit;
- track.

Cashier:
- open table;
- confirm;
- payment.

Kitchen:
- receive;
- start;
- ready.

Measure completion and SUS if approved.

---

# 229. FINAL MVP DEFINITION OF DONE

The product is MVP-complete only if all are true:

- [ ] Django 5.2 LTS project;
- [ ] PostgreSQL production;
- [ ] Redis;
- [ ] staff auth;
- [ ] RBAC;
- [ ] tables;
- [ ] QR tokens;
- [ ] table sessions;
- [ ] catalog;
- [ ] customer PWA;
- [ ] cart;
- [ ] server pricing;
- [ ] idempotent submit;
- [ ] pending gate;
- [ ] cashier confirmation;
- [ ] kitchen queue;
- [ ] WebSocket;
- [ ] polling fallback;
- [ ] bill;
- [ ] cash payment;
- [ ] change calculation;
- [ ] close table;
- [ ] audit;
- [ ] reports;
- [ ] offline safe behavior;
- [ ] rate limits;
- [ ] security hardening;
- [ ] backup;
- [ ] Docker deployment;
- [ ] unit tests;
- [ ] concurrency tests;
- [ ] E2E;
- [ ] PWA tests;
- [ ] thesis metrics.

---

# 230. FINAL ARCHITECTURE DECISIONS

ADR-001:
Use Django modular monolith.

ADR-002:
Use Django 5.2 LTS baseline for stability.

ADR-003:
Use PostgreSQL as canonical database.

ADR-004:
Use Redis only for ephemeral cache/channel/broker.

ADR-005:
Use Channels WebSocket + polling fallback.

ADR-006:
Use server-rendered Django Templates + Bootstrap + vanilla JS.

ADR-007:
Do not require React/Vue.

ADR-008:
Use cashier confirmation before kitchen.

ADR-009:
Use active table session.

ADR-010:
Use cash payment MVP.

ADR-011:
No offline mutation success.

ADR-012:
Use transaction + row locks on critical races.

ADR-013:
Use idempotency for retryable mutations.

ADR-014:
Use server-authoritative price/total/state.

ADR-015:
Use Docker deployment.

---

# 231. IMPLEMENTATION PRIORITY WHEN TIME IS LIMITED

If thesis deadline tight, do in this exact order:

P0:

1. auth;
2. tables/session;
3. menu;
4. customer order;
5. cashier confirm;
6. kitchen states;
7. payment;
8. PWA manifest/SW;
9. tests.

P1:

10. WebSocket;
11. polling fallback;
12. rate limiting;
13. idempotency;
14. audit;
15. reports.

Important:
Idempotency/concurrency/security should still be completed before final thesis claim.

---

# 232. ANTI-PATTERNS

Do not:

- create one giant Django app;
- one giant views.py;
- use signals for all business logic;
- rely on model `save()` side effects for complex transitions;
- perform WebSocket publish before commit;
- hardcode role strings in 50 files;
- hardcode menu prices in JS;
- use client timestamp as official;
- trust hidden input fields;
- allow arbitrary next status;
- make frontend decide permissions;
- store JSON blobs instead of relational fields for core entities;
- use float;
- use SQLite production;
- treat Redis as payment DB;
- cache POST;
- call external network inside DB transaction;
- delete financial records.

---

# 233. MODEL CONSTANTS

Use enums:

```python
class OrderStatus(models.TextChoices):
    WAITING_CASHIER_CONFIRMATION = "WAITING_CASHIER_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    PREPARING = "PREPARING"
    READY = "READY"
    SERVED = "SERVED"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
```

Avoid typo-prone free strings.

---

# 234. DOMAIN EXCEPTIONS

Examples:

```text
InvalidOrderState
TableSessionClosed
MenuItemUnavailable
PriceChanged
DuplicateIdempotencyConflict
PaymentAlreadyCompleted
PermissionDeniedDomain
```

Map to stable API codes.

---

# 235. SERVICE RETURN TYPES

Service should return domain object/result, not raw HttpResponse.

Views translate result -> HTTP.

This allows tests and reuse.

---

# 236. SIGNAL USAGE

Django signals may be used for low-risk ancillary behavior.

Do not hide:

- payment;
- state transitions;
- critical audit;

inside opaque signal chains.

Prefer explicit service calls.

---

# 237. TEST COVERAGE TARGET

Target:

- overall >= 80%;
- critical services >= 95% branch where practical.

Coverage number alone is not quality.

Concurrency/E2E more important for certain risks.

---

# 238. SECURITY REVIEW GATE

Before final:

- dependency scan;
- secret scan;
- settings review;
- endpoint permission matrix;
- public API object scoping;
- service worker cache review;
- CSP review;
- upload review;
- log review.

---

# 239. PERFORMANCE REVIEW GATE

Inspect:

- kitchen queue queries;
- cashier pending queries;
- menu load;
- report queries;
- DB indexes;
- connection counts;
- image sizes.

---

# 240. PRODUCTION DATA INITIALIZATION

Do not use demo seed command automatically.

Production setup command separate:

```text
bootstrap_restaurant
```

Interactive or env-driven.

Creates:

- restaurant;
- admin only.

Then admin creates operational data.

---

# 241. ROLLBACK DEPLOYMENT

Keep previous image/tag.

If app deploy fails before migration destructive change:

- rollback container.

For schema migration:

- backup;
- forward-compatible migrations preferred.

Avoid destructive column removal before code transition.

---

# 242. DATABASE CONNECTIONS

Set reasonable connection lifetime.

Monitor max connections.

For small deployment:

- do not create excessive Daphne/worker processes that exhaust PostgreSQL.

Tune after load test.

---

# 243. WORKER CONCURRENCY

Celery task volume tiny.

Start low concurrency.

Do not oversubscribe small VPS.

The web request path remains priority during restaurant hours.

---

# 244. STATIC MENU IMAGE OPTIMIZATION

On upload:

- validate;
- optional thumbnail;
- WebP optional;
- retain fallback.

Frontend:

- lazy loading;
- width/height attributes.

Goal reduce data usage.

---

# 245. QR LANDING PERFORMANCE

QR landing should be minimal.

Avoid loading all giant menu images immediately.

Load category/item images lazy.

---

# 246. CUSTOMER EXPERIENCE UNDER SLOW NETWORK

Show:

- skeleton/loading;
- network status;
- retry.

Do not let user click submit repeatedly.

Persist cart locally.

---

# 247. CASHIER EXPERIENCE UNDER SLOW NETWORK

Confirm button states:

```text
idle
submitting
success
conflict
failed
```

On timeout:

- re-fetch order;
- do not blindly send new logical action key.

---

# 248. KITCHEN EXPERIENCE UNDER SLOW NETWORK

State update timeout:

- fetch order;
- inspect canonical state;
- display result.

Avoid duplicate “start” transitions.

---

# 249. DATA CONSISTENCY OVER AVAILABILITY

For payment/order creation, prioritize correctness.

If DB unavailable:

- temporary service unavailable preferable to accepting untracked transaction.

---

# 250. SYSTEM SUCCESS CRITERIA

System considered successful for thesis prototype if:

1. QR correctly resolves table.
2. Only active table can order.
3. Menu loads.
4. Server validates price and availability.
5. Duplicate submission prevented.
6. Pending order not visible kitchen.
7. Cashier can confirm/reject.
8. Confirmed order visible kitchen.
9. Kitchen state transitions valid.
10. Customer sees status.
11. WebSocket fallback works.
12. Payment cash accurate.
13. Duplicate payment prevented.
14. Table session closes correctly.
15. Reports correct.
16. PWA can operate as installable web app on supported browser.
17. Offline mutation cannot create false success.
18. Role/access controls pass.
19. Concurrency tests pass.
20. Backup restore demonstrated.

---

# APPENDIX A — CORE SEQUENCE: ORDER

```text
Customer      Django        PostgreSQL       Redis/WS       Cashier       Kitchen
   |             |               |               |              |             |
   | POST order  |               |               |              |             |
   |------------>| BEGIN         |               |              |             |
   |             | validate      |               |              |             |
   |             | insert------->|               |              |             |
   |             | COMMIT------->|               |              |             |
   |             | on_commit-------------------->|------------->|             |
   |<------------| 201 pending   |               |              |             |
   |             |               |               |              |             |
   |             |               |               | confirm      |             |
   |             |<---------------------------------------------|             |
   |             | lock/update-->|               |              |             |
   |             | COMMIT------->|               |              |             |
   |             | on_commit-------------------->|              |------------>|
   |<--------------------------------------------| event        |             |
```

---

# APPENDIX B — CORE SEQUENCE: PAYMENT

```text
Cashier
  |
POST payment + idem key
  |
Django
  |
BEGIN
  |
lock TableSession
  |
calculate bill from DB
  |
check existing completed payment
  |
create payment
  |
set session PAID
  |
audit
  |
COMMIT
  |
on_commit notify
  |
return bill/cash/change
```

---

# APPENDIX C — PERMISSION SUMMARY

| Resource | Customer | Cashier | Kitchen | Admin |
|---|---:|---:|---:|---:|
| Public menu | R | R | R | RW |
| Table session active detail | scoped R | R | limited R | R |
| Submit order | C scoped | C | no | C |
| Confirm order | no | yes | no | yes |
| Kitchen status | R own session | R | RW transitions | RW |
| Payment | R final scoped | RW | no | RW |
| Menu price | R | R | R | RW |
| Users | no | no | no | RW |
| Reports | no | limited | no | RW |
| Audit | no | limited/no | no | R |

---

# APPENDIX D — CACHE ALLOWLIST

Safe candidates:

```text
/static/css/*
/static/js/*
/static/icons/*
/offline/
/media/menu/* public images
/api/v1/public/menu/* GET with controlled strategy
```

Sensitive bypass:

```text
/admin/*
/cashier/*
/kitchen/*
/api/v1/cashier/*
/api/v1/kitchen/*
/api/v1/admin/*
POST/PUT/PATCH/DELETE any
```

---

# APPENDIX E — STATUS COLORS

UI may use color but text mandatory.

Example semantics:

```text
WAITING  amber
CONFIRMED blue
PREPARING purple
READY green
SERVED neutral
REJECTED red
CANCELLED gray/red
```

Actual brand palette determined later.

---

# APPENDIX F — THESIS DOCUMENT MAPPING

BAB I:
- problem;
- goals;
- scope.

BAB II:
- PWA;
- Django;
- QR;
- DB transaction;
- WebSocket;
- security;
- usability testing.

BAB III:
- methodology;
- requirement;
- architecture;
- UML;
- ERD;
- state diagrams;
- test plan.

BAB IV:
- implementation;
- screenshots;
- test results;
- performance;
- security/concurrency tests;
- SUS.

BAB V:
- conclusion;
- limitations;
- future work.

---

# APPENDIX G — UML ARTIFACTS TO CREATE

Required:

- use case diagram;
- activity customer order;
- activity cashier confirmation;
- activity kitchen;
- activity payment;
- sequence order;
- sequence payment;
- class/domain diagram;
- deployment diagram;
- state machine order;
- state machine table session;
- ERD.

---

# APPENDIX H — MINIMUM DOCUMENTS BESIDE PRD

Repository should eventually contain:

```text
README.md
CHANGELOG.md
docs/architecture.md
docs/erd.md
docs/api.md
docs/security.md
docs/testing.md
docs/deployment.md
docs/runbook.md
docs/test-matrix.md
```

---

# APPENDIX I — SOURCE/TECHNOLOGY NOTES

Technology baseline was selected around the following official project capabilities:

- Django 5.2 is an LTS release and supports modern Python releases.
- Django provides transaction primitives and ORM row locking support on PostgreSQL.
- Django provides CSRF and security middleware mechanisms.
- Django cache framework supports Redis.
- Django Channels extends Django/ASGI for WebSocket-style real-time connections.
- PostgreSQL provides row-level locking and concurrency control.
- Web App Manifest and Service Workers are standardized web platform building blocks for PWA behavior.

Always consult current official documentation before dependency upgrade.

---

# APPENDIX J — FINAL IMPLEMENTOR COMMANDMENT

If an AI agent or developer must choose between:

**“lebih cepat dibuat”** dan **“menjaga integritas order/payment”**,

pilih integritas.

Jika tidak yakin apakah sebuah order/payment berhasil karena timeout:

- jangan membuat transaksi baru secara buta;
- gunakan idempotency;
- baca canonical state dari server.

Jika WebSocket mengatakan sesuatu yang berbeda dari database:

- database menang.

Jika frontend mengirim harga berbeda dari database:

- database menang.

Jika dua staff melakukan transition bersamaan:

- transaction/state machine menentukan satu hasil canonical.

Jika QR valid tetapi table session tidak aktif:

- order ditolak.

Jika order belum dikonfirmasi:

- dapur tidak boleh memproses.

**END OF LEGACY BASELINE v1.0.0 — CONTINUE TO PRODUCTION PART II BELOW**

---

# PART II — PRODUCTION-READY ENGINEERING BASELINE v2.0

Bagian ini meng-overrule ketentuan PRD v1 apabila terdapat konflik. Semua requirement pada bagian ini berstatus **MUST** kecuali diberi label SHOULD/COULD.

# 251. DEFINISI PRODUCTION READY

Sistem hanya boleh diberi label production-ready jika seluruh kondisi berikut terpenuhi:

1. Core feature selesai dan tidak memiliki P0/P1 blocker terbuka.
2. Critical mutation order/payment bersifat atomic dan concurrency-safe.
3. Duplicate submit dan duplicate payment terlindungi idempotency.
4. Cashier verification gate tidak dapat dilewati customer.
5. PostgreSQL menjadi canonical source of truth.
6. Redis/WebSocket failure hanya menyebabkan degraded realtime, bukan kehilangan order/payment.
7. Production tidak memakai `runserver` dan `DEBUG=False`.
8. HTTPS valid dan certificate renewal dimonitor.
9. Database/Redis tidak terekspos guest/public network.
10. Secret berada di secret store/file protected, bukan repository/image.
11. Backup otomatis tersedia, terenkripsi off-site, dan restore drill pernah lulus.
12. Monitoring, alerting, health checks, log rotation, disk alert, dan TLS alert aktif.
13. Staging menyerupai production dan menggunakan image build yang sama.
14. CI/CD melewati unit, integration, security, concurrency, migration, PWA, dan E2E tests.
15. Rollback/forward-fix procedure terdokumentasi dan diuji.
16. Manual business-continuity procedure tersedia untuk total edge/LAN failure.
17. Staff cashier/kitchen/admin memiliki SOP.
18. Go-live preflight lulus 100% untuk semua P0 gate.

Production-ready berarti selected scope dine-in/cash dapat dioperasikan, dipantau, dipulihkan, dan dipelihara secara nyata; bukan klaim sistem tidak akan pernah gagal.

# 252. PRODUCTION ASSUMPTIONS

```text
Restaurant count                 1
Tables                           10–50
Concurrent customer browsers     <= 200
Concurrent staff browsers        <= 30
Peak order submissions           <= 50/minute
Peak WebSocket connections       <= 300
Historical order items           <= 1,000,000
Currency                         USD
Timezone                         Asia/Dili
Customer account                 Not required
Primary payment                  CASH
Internet dependency for core     NO
```

Capacity review wajib jika traffic >2x baseline secara konsisten.

# 253. DEPLOYMENT PROFILE — LOCAL EDGE PRIMARY

Konteks Timor-Leste membuat cloud-only deployment kurang ideal. Baseline production adalah **local-edge first**.

```text
Customer Phone / Cashier / Kitchen
              |
          Wi-Fi / LAN
              |
      Router / Switch / AP
              |
       Wired Gigabit LAN
              |
+-----------------------------------------+
| Local Edge Production Server            |
| Nginx :443                              |
| Django/Daphne A                         |
| Django/Daphne B                         |
| Celery Worker                           |
| Celery Beat (exactly one)               |
| PostgreSQL                              |
| Redis Realtime                          |
| Redis Jobs                              |
| Metrics / Backup Agent                  |
+----------------------+------------------+
                       |
                  WAN when available
                       |
              Encrypted Off-site Backup
```

Core ordering/payment tetap berjalan saat ISP putus selama LAN, edge server, TLS certificate, PostgreSQL, dan aplikasi sehat.

Cloud VPS tetap didukung sebagai deployment alternatif tetapi tidak boleh diklaim tahan WAN outage jika backend sepenuhnya berada di cloud.

# 254. EDGE HARDWARE BASELINE

Minimum:

```text
CPU      x86_64 4 cores
RAM      8 GB
Storage  256 GB SSD
NIC      Gigabit Ethernet
UPS      Mandatory
```

Recommended:

```text
CPU      4–8 modern cores
RAM      16 GB
Storage  512 GB NVMe SSD
NIC      wired 1 Gbps
UPS      600–1000 VA class
Spare    tested SSD or cold-spare host
```

MUST:

- server menggunakan wired Ethernet;
- BIOS auto power-on after AC recovery;
- router/switch/AP critical ikut UPS;
- SSD SMART dan free disk dimonitor;
- airflow/ventilation memadai;
- physical access dibatasi staff/operator;
- production host tidak dipakai sebagai PC general-purpose.

# 255. POWER FAILURE STRATEGY

Short outage: UPS mempertahankan server + network.

Extended outage:

1. stop accepting new customer orders jika battery warning memberi waktu;
2. graceful shutdown web/worker;
3. stop PostgreSQL secara clean;
4. shut down host sebelum UPS habis.

Recovery:

1. host auto-start;
2. storage check jika diperlukan;
3. PostgreSQL/Redis/application start;
4. health checks lulus;
5. Nginx menerima traffic;
6. integrity check dijalankan jika shutdown tidak bersih;
7. manual records direkonsiliasi jika fallback digunakan.

# 256. TOTAL SYSTEM OUTAGE — MANUAL FALLBACK

PWA tidak melakukan offline transaction finalization.

Jika edge/LAN total gagal:

```text
DIGITAL MODE
    -> MANUAL FALLBACK
    -> numbered paper order
    -> kitchen paper ticket
    -> cash manual ledger
    -> system recovery
    -> audited recovery entry
    -> reconciliation
```

Aturan:

- setiap manual ticket memiliki unique manual reference;
- kitchen hanya memproses ticket bernomor;
- cashier mencatat cash payment manual;
- setelah recovery, admin input `RECOVERY_MANUAL`;
- recovery record tidak menyamar sebagai order realtime;
- paper reference disimpan sesuai kebijakan restoran.

# 257. RECOVERY ENTRY MODEL

```text
recovery_entries
----------------
id UUID PK
restaurant_id FK
manual_reference varchar
occurred_at timestamptz
table_label varchar
gross_amount numeric(12,2)
payment_method CASH
description text
entered_by FK user
approved_by FK user nullable
status DRAFT/APPROVED/VOIDED
created_at timestamptz
updated_at timestamptz
```

Constraints:

- unique restaurant + manual_reference;
- amount >= 0;
- report hanya menghitung APPROVED;
- approval dan void audited;
- tidak mengubah historical digital orders.

# 258. NETWORK SEGMENTATION

Recommended:

```text
VLAN 10 SERVER
VLAN 20 STAFF
VLAN 30 GUEST
VLAN 40 MANAGEMENT optional
```

Guest policy:

```text
ALLOW -> app server 443
DENY  -> PostgreSQL 5432
DENY  -> Redis
DENY  -> SSH
DENY  -> monitoring/admin management ports
```

Staff policy:

- access app 443;
- admin operational UI sesuai role;
- SSH hanya management device/VPN;
- tidak ada direct DB access untuk normal operation.

# 259. HOST FIREWALL

Expose:

```text
443/tcp required
80/tcp optional redirect/ACME only
22/tcp management network/VPN only
```

Never public/guest:

```text
5432
6379
8000
3000
9090
Docker API/socket
```

PostgreSQL/Redis hanya private Docker/backend network.

# 260. LOCAL HTTPS, DNS, DAN PWA

PWA production membutuhkan secure context.

Gunakan domain nyata, misalnya:

```text
order.restaurant.example
```

Inside restaurant gunakan split-horizon DNS:

```text
order.restaurant.example -> LOCAL_EDGE_IP
```

Certificate berasal dari trusted CA. DNS-01 ACME lebih cocok bila edge tidak menerima inbound internet.

Alert certificate expiry:

```text
30d / 14d / 7d / 3d
```

Expired certificate saat jam operasi adalah SEV-1.

# 261. CLOCK / NTP

Host MUST menjalankan NTP/chrony.

Clock digunakan untuk:

- audit;
- order/payment timestamps;
- TLS;
- token expiry;
- daily report boundary.

Store UTC; display Asia/Dili.

# 262. OS BASELINE

Recommended Ubuntu Server LTS atau Debian stable.

Hardening:

- minimal packages;
- no desktop environment;
- security updates policy;
- SSH key auth;
- root SSH disabled;
- firewall enabled;
- host dedicated;
- disk encryption SHOULD jika physical theft risk material.

# 263. CONTAINER SECURITY

Custom containers MUST:

- run non-root;
- use fixed UID/GID;
- multi-stage build where useful;
- minimal runtime image;
- `no-new-privileges`;
- drop unneeded capabilities;
- no Docker socket mount;
- healthcheck;
- resource limits;
- immutable tag/digest;
- secrets mounted read-only.

# 264. PRODUCTION SERVICE TOPOLOGY

Core compose services:

```text
nginx
web_a
web_b
worker
beat
postgres
redis_realtime
redis_jobs
backup
prometheus
alertmanager
grafana
node_exporter
postgres_exporter
redis_exporter_realtime
redis_exporter_jobs
```

Optional logging stack tidak boleh menjadi dependency core ordering.

# 265. NGINX RESPONSIBILITY

Nginx owns:

- TLS termination;
- HTTP->HTTPS;
- allowed host/default server rejection;
- static/menu media;
- reverse proxy;
- WebSocket upgrade;
- request size/timeouts;
- security headers where designated;
- access logs;
- gross IP rate limits.

Nginx tidak melakukan business authorization.

# 266. NGINX ROUTES

```text
/static/              hashed static
/media/menu/          public validated menu images
/ws/                  WebSocket ASGI
/api/                 Django ASGI
/customer/            Django ASGI
/cashier/             Django ASGI
/kitchen/             Django ASGI
/admin/               Django ASGI + staff/VPN restriction preferred
```

# 267. REQUEST LIMITS

Starting values:

```text
client_max_body_size    6m
client_body_timeout     15s
client_header_timeout   15s
send_timeout            30s
```

WebSocket uses longer read timeout.

# 268. HTTP SECURITY HEADERS

Review/set:

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options: nosniff
Referrer-Policy
Permissions-Policy
X-Frame-Options or CSP frame-ancestors
```

One layer is owner per header to avoid conflict.

# 269. CSP BASELINE

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
connect-src 'self' wss:;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
```

Locally host Bootstrap/assets. Avoid `unsafe-inline`; use nonce/hash if necessary.

# 270. DJANGO PRODUCTION SETTINGS

MUST:

```python
DEBUG = False
USE_TZ = True
TIME_ZONE = "Asia/Dili"
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
```

Also explicitly configure:

- SECRET_KEY;
- ALLOWED_HOSTS;
- CSRF_TRUSTED_ORIGINS;
- SECURE_PROXY_SSL_HEADER only with trusted Nginx configuration;
- HSTS only after HTTPS verified.

Every release runs:

```text
python manage.py check --deploy
```

# 271. SECRET MANAGEMENT

Secrets:

- Django SECRET_KEY;
- DB runtime password;
- migration role password;
- backup encryption key;
- offsite credential;
- monitoring webhook if any.

Production baseline:

```text
root-owned files
mode 0600
mounted read-only
```

No secret in Git, image, README, screenshot, logs, or AI prompt.

# 272. SECRET ROTATION

Django SECRET_KEY rotation:

1. new current key;
2. old key temporarily in `SECRET_KEY_FALLBACKS`;
3. deploy;
4. observe;
5. remove old fallback within defined window.

Compromise triggers session/credential review and immediate rotation.

# 273. DATABASE ROLE SEPARATION

Roles:

```text
postgres_superadmin   setup only
resto_migrator        DDL
resto_app             runtime CRUD
resto_backup          backup
resto_monitor         metrics
```

Runtime app is NOT superuser and cannot create/drop DB/roles.

# 274. DATABASE VERSION BASELINE

Production baseline:

```text
PostgreSQL 18.4 or newer supported 18.x minor/security patch
```

Minor security updates staged and applied promptly.

# 275. POSTGRESQL AUTH

Use SCRAM.

No legacy MD5 password storage for new deployment.

`pg_hba.conf` only trusts explicit application/maintenance networks.

# 276. ASGI DATABASE CONNECTION POOL

ASGI baseline:

```text
CONN_MAX_AGE = 0
```

Use psycopg pool:

```python
DATABASES["default"]["OPTIONS"]["pool"] = {
    "min_size": 1,
    "max_size": 8,
    "timeout": 5,
}
```

Exact max is capacity-tested.

Total worst-case connections from all web/worker/monitor/backup processes MUST stay below PostgreSQL safety budget.

# 277. DATABASE TIMEOUTS

Starting guardrails:

```text
statement_timeout                    10s
lock_timeout                          2s
idle_in_transaction_session_timeout 30s
```

Large reporting/export uses dedicated path with explicit higher timeout.

# 278. DATABASE ISOLATION

Default READ COMMITTED.

Correctness comes from:

- constraints;
- `transaction.atomic()`;
- `select_for_update()`;
- idempotency;
- state revalidation.

Do not globally switch SERIALIZABLE to compensate for missing business locking.

# 279. TRANSACTION LENGTH

Inside transaction allowed:

- DB reads/writes;
- deterministic calculations;
- state/constraint validation.

Forbidden:

- external HTTP;
- Redis publish;
- email;
- file upload processing;
- sleep;
- remote backup;
- long report.

# 280. LOCK ORDER

Where multiple objects require lock, use consistent order:

```text
RestaurantTable
-> TableSession
-> Order
-> Payment/CashierShift
```

This reduces deadlocks.

# 281. RESOURCE BUSY UX

Lock timeout/concurrent conflict:

```text
409 RESOURCE_BUSY
```

Client refetches canonical state. No indefinite spinner.

# 282. DATABASE CONSTRAINT MANDATE

Critical invariants must be protected at DB level where expressible:

- unique active session;
- unique idempotency key scope;
- positive quantity;
- nonnegative money;
- unique order/payment code;
- FK integrity.

# 283. ONE ACTIVE TABLE SESSION

Use PostgreSQL partial unique constraint conceptually:

```sql
UNIQUE(table_id)
WHERE status IN ('OPEN','BILL_REQUESTED','PAYMENT_PENDING','PAID')
```

Concurrency test must prove two simultaneous open attempts create one active session only.

# 284. TRANSACTIONAL OUTBOX — REQUIRED

Direct WebSocket publish setelah commit masih memiliki failure window: DB sudah commit tetapi Redis publish gagal/crash.

Production design:

```text
business transaction
   |
   +-- mutate domain
   +-- history
   +-- audit
   +-- insert outbox_event
   |
 COMMIT
   |
dispatcher
   |
Redis/Channels
   |
clients
```

Domain state dan event intent tersimpan atomically di PostgreSQL.

# 285. OUTBOX_EVENTS SCHEMA

```text
outbox_events
-------------
id UUID PK
event_id UUID UNIQUE
aggregate_type varchar(80)
aggregate_id UUID
event_type varchar(120)
event_version integer
payload JSONB
status PENDING/PROCESSING/DISPATCHED/DEAD
attempt_count integer
next_attempt_at timestamptz
locked_at timestamptz nullable
last_error text nullable
created_at timestamptz
dispatched_at timestamptz nullable
```

Indexes:

```text
(status, next_attempt_at, created_at)
(aggregate_type, aggregate_id)
event_id unique
```

# 286. OUTBOX WRITE RULE

Inside same `transaction.atomic()`:

```text
mutate business state
write status history
write audit
write outbox
COMMIT
```

Never commit business state first and create outbox in independent transaction.

# 287. OUTBOX DISPATCHER

Algorithm:

1. select batch `PENDING` where due;
2. claim rows using `FOR UPDATE SKIP LOCKED`;
3. publish event;
4. mark DISPATCHED;
5. failure increments attempt;
6. exponential backoff;
7. max attempts -> DEAD;
8. DEAD event triggers alert.

Multiple dispatcher workers may operate safely.

# 288. OUTBOX DELIVERY SEMANTICS

Target is **at-least-once**, not exactly-once.

Therefore:

- event has stable `event_id`;
- duplicate delivery is legal;
- UI consumer ignores duplicate/refetches canonical state;
- business mutation is never triggered purely by receiving UI event.

# 289. AGGREGATE VERSIONING

Orders, payments, dan table sessions SHOULD have:

```text
version PositiveBigInteger default 1
```

Every mutation increments version.

Event example:

```json
{
  "event_id": "uuid",
  "event_type": "order.ready",
  "aggregate_id": "uuid",
  "aggregate_version": 8
}
```

Client rules:

- higher version -> apply/refetch;
- same -> duplicate/no-op;
- lower -> ignore;
- version gap -> refetch canonical state.

# 290. REDIS SPLIT

## redis_realtime

Use for Channels/realtime.

Loss impact:

- realtime degraded;
- polling recovers;
- domain data unchanged.

## redis_jobs

Use for Celery broker/background tasks.

Enable suitable persistence and monitor queue/memory.

Do not use either as order/payment source of truth.

# 291. REDIS MEMORY

Explicitly configure and monitor:

- max memory;
- eviction policy;
- used memory;
- fragmentation;
- evictions;
- connection count;
- queue depth.

Unexpected eviction on job broker is incident.

# 292. CELERY PRODUCTION RULES

- exactly one Beat;
- task payload small IDs/primitives;
- no pickled Django model;
- task loads canonical state from DB;
- idempotent;
- retry transient error only;
- soft/hard time limits for hang-prone tasks;
- stale task detects terminal state and exits no-op;
- report tasks separated from operational queue.

# 293. CELERY QUEUES

```text
critical
maintenance
default
reports
```

Long report cannot block expiration/outbox operational work.

# 294. PENDING ORDER EXPIRATION

Do not rely on a single scheduled ETA message.

Periodic DB scan:

1. find candidate pending order by timestamp;
2. lock order;
3. recheck status;
4. mark CANCELLED reason `PENDING_TIMEOUT`;
5. history;
6. audit/system event;
7. outbox.

Second execution is no-op.

# 295. BUSINESS HOURS

Add:

```text
business_hours
--------------
weekday
open_time
close_time
is_closed
```

Customer ordering additionally checks:

- `ordering_enabled`;
- table active;
- optional business-hours rule.

Staff override requires authorization + audit.

# 296. ORDERING KILL SWITCH

Restaurant setting:

```text
ordering_enabled boolean
ordering_disabled_reason text
```

Use during:

- kitchen overload;
- maintenance;
- emergency;
- major stock problem.

Existing confirmed orders remain processable.

# 297. CASHIER SHIFT — REQUIRED PRODUCTION CASH CONTROL

```text
cashier_shifts
--------------
id UUID PK
restaurant_id FK
cashier_id FK
register_code varchar
status OPEN/CLOSED
opened_at timestamptz
opening_float numeric(12,2)
expected_cash numeric(12,2)
counted_cash numeric(12,2) nullable
variance numeric(12,2) nullable
closed_at timestamptz nullable
closed_by FK nullable
notes text
```

Payment cash requires an OPEN shift unless admin emergency override.

# 298. CASHIER SHIFT RULES

- opening float entered at open;
- payment references shift;
- expected cash computed server-side;
- cashier enters counted cash at close;
- variance computed server-side;
- completed payments are not edited/deleted to hide variance;
- close audited;
- stale open shift alerted.

# 299. PAYMENT SCHEMA REFACTOR

Existing payment model adds:

```text
cashier_shift_id FK
currency char(3) default USD
bill_snapshot JSONB or normalized immutable receipt snapshot
```

Completed payment is immutable except explicit VOID workflow.

# 300. PAYMENT VOID

Authorized only.

Requires:

- existing COMPLETED payment;
- reason code/note;
- actor;
- timestamp;
- optional second approval policy;
- audit;
- state -> VOIDED.

Original row is never deleted.

# 301. REFUND

No electronic refund baseline.

Cash refund, if later introduced, is explicit transaction type/workflow. Never use silent negative amount to simulate refund.

# 302. RECEIPT SNAPSHOT

At payment commit store data required to reproduce exact receipt:

- restaurant display name;
- table;
- item name snapshot;
- quantities;
- unit prices;
- tax/service rates applied;
- total;
- tendered;
- change;
- cashier;
- paid_at;
- payment code.

Reprint does not recalculate from current menu.

# 303. FINANCIAL REPORT SOURCE

Revenue derives from:

```text
COMPLETED payments
- VOIDED/REFUNDED according explicit policy
+ APPROVED manual recovery entries
```

Never from pending/confirmed carts/orders.

# 304. DAILY CASH RECONCILIATION

Output:

```text
Digital completed cash
Approved manual recovery cash
Voided transactions
Expected cash per shift
Counted cash
Variance
```

Useful for production control and thesis validation.

# 305. ADMIN MFA

If admin is reachable outside trusted staff LAN/VPN, MFA is MUST.

TOTP recommended.

If admin is strictly LAN-only, MFA remains SHOULD.

SSH remote maintenance is VPN + SSH key, not public password-only access.

# 306. STAFF SESSION POLICY

Cashier/kitchen session timeout appropriate to shift/device.

Admin uses shorter idle timeout and reauthentication for critical actions SHOULD.

Deactivated account cannot continue privileged operation indefinitely.

# 307. AUTHORIZATION POLICY LAYER

Centralize:

```text
can_confirm_order
can_reject_order
can_cancel_confirmed_order
can_complete_payment
can_void_payment
can_manage_users
can_rotate_qr
can_close_shift
can_disable_ordering
```

Backend policy authoritative. UI hiding is convenience only.

# 308. STAFF DEVICE SECURITY

Recommended dedicated devices.

Requirements:

- OS/browser updates;
- screen lock;
- no shared admin password;
- lost/stolen device response;
- kiosk only if authentication remains secure;
- no staff password stored in URL/localStorage.

# 309. AUDIT IMMUTABILITY

Application UI cannot update/delete audit.

Database SHOULD enforce append-only through role permissions/trigger.

Optional tamper-evidence:

```text
previous_event_hash
event_hash
```

Hash chain is extra detection, not replacement for DB security.

# 310. AUDIT RETENTION

Recommended production prototype:

```text
financial/audit >= 1 year
```

Final legal/business retention must be reviewed locally.

# 311. DATA CLASSIFICATION

Class A Critical:

- order;
- payment;
- shift;
- audit;
- table session.

Class B Operational:

- menu;
- category;
- business settings.

Class C Ephemeral:

- cache;
- WebSocket;
- rate-limit counter.

# 312. PII MINIMIZATION

Customer baseline does not collect name/email/phone/account.

Staff stores minimum operational identity.

No third-party marketing tracker on token-bearing ordering pages by default.

# 313. BACKUP 3-2-1

Target:

```text
3 copies
2 locations/storage types
1 off-site encrypted
```

Layers:

1. live PostgreSQL;
2. local backup volume;
3. encrypted off-site backup.

# 314. BACKUP TYPES

Logical nightly:

```text
pg_dump -Fc
```

Production SHOULD additionally implement physical base backup + WAL archiving for PITR.

Menu media backed up separately/in filesystem backup.

# 315. RETENTION

Starting policy:

```text
Daily logical    14
Weekly/base       8
Monthly          12
WAL              PITR retention window
```

Tune to storage and business policy.

# 316. BACKUP ENCRYPTION

Off-site backup MUST be encrypted before upload.

Key is stored separately from backup repository.

Key recovery procedure documented and tested.

# 317. BACKUP MONITORING

Alert if:

- last logical backup >26h;
- WAL archive stalled;
- backup failed;
- destination low disk;
- offsite sync stale;
- checksum/verification failed.

# 318. RESTORE DRILL

Minimum quarterly after stable; monthly during development/go-live phase.

Drill:

1. restore isolated;
2. verify row counts/data timestamp;
3. run migrations as appropriate;
4. application smoke;
5. payment/report validation;
6. media validation;
7. record RTO/RPO;
8. destroy test restore securely.

Backup is not “verified” until restore succeeds.

# 319. DR TARGETS

Design targets:

```text
App/process restart RTO            <= 10 min
Cold-spare host restore RTO        <= 60 min
DB restore RTO                     <= 60 min
PITR RPO when WAL healthy          <= 5 min target
Offsite-only RPO during long WAN   <= 24h
```

Must be measured, not assumed.

# 320. COLD SPARE

Recommended:

- second compatible mini-PC or replacement procedure;
- release package/config available;
- secrets recovery;
- latest backup accessible;
- restore rehearsed.

Do not run a second writable DB “for backup” without replication/failover design.

# 321. NO ACTIVE-ACTIVE DIY DB

Two writable PostgreSQL primaries that later “sync” are prohibited.

Future HA must enforce single authoritative writer and split-brain protection.

# 322. OBSERVABILITY

Minimum:

- metrics;
- structured logs;
- request IDs.

Tracing is SHOULD, not required baseline.

# 323. APPLICATION METRICS

```text
http_requests_total
http_request_duration_seconds
http_5xx_total
orders_submitted_total
orders_confirmed_total
orders_rejected_total
orders_cancelled_total
payments_completed_total
payment_conflicts_total
idempotency_replay_total
rate_limit_hits_total
websocket_connections
outbox_pending
outbox_dead
celery_queue_depth
oldest_pending_order_seconds
```

No high-cardinality order UUID labels.

# 324. INFRA METRICS

Monitor:

- CPU/RAM/load;
- disk/inodes/IO;
- container restarts;
- PostgreSQL connections/deadlocks/long transaction/DB size;
- Redis memory/eviction/connections;
- queue depth;
- certificate expiry;
- backup age;
- UPS status if integration available.

# 325. ALERT THRESHOLDS

Starting values:

```text
SEV1 app unavailable >2m during open hours
SEV1 PostgreSQL unavailable
SEV1 TLS expired
SEV1 suspected data corruption
SEV2 disk >85%
SEV2 backup >26h stale
SEV2 outbox DEAD >0
SEV2 5xx >2% for 5m
SEV2 DB connections >80%
SEV2 jobs broker unavailable
SEV3 TLS <14 days
SEV3 sustained CPU/RAM >85%
```

Tune using real traffic.

# 326. ALERT QUALITY

Every alert has:

- owner;
- severity;
- meaning;
- first action;
- runbook;
- resolution condition.

No alert nobody can act upon.

# 327. STRUCTURED LOG

Example:

```json
{
  "timestamp": "...",
  "level": "INFO",
  "service": "web",
  "request_id": "...",
  "user_id": "...",
  "role": "CASHIER",
  "route": "/api/v1/...",
  "method": "POST",
  "status": 200,
  "duration_ms": 84,
  "event": "order.confirmed"
}
```

Never log password, cookie, secret, full session token.

# 328. LOG RETENTION

Suggested:

```text
application logs 14–30d
security logs    >=90d
audit DB         longer business policy
```

Rotation mandatory.

# 329. ERROR MONITORING

Unexpected exceptions must be aggregated locally or external service if policy/internet allows.

Include:

- release version;
- stack trace internally;
- request ID;
- safe user/route context.

Never return traceback to browser.

# 330. RELEASE IDENTIFICATION

Running app exposes internally/safely:

```text
APP_VERSION
GIT_SHA
BUILD_TIME
SCHEMA_COMPAT_VERSION
```

Response MAY include `X-App-Version`.

# 331. PWA BUILD VERSION

Cache prefix uses immutable build ID, e.g. Git SHA.

Old cache retired by service-worker activation policy.

# 332. STALE PWA CLIENT

API v1 remains backward compatible through blue-green rollout.

Breaking client change requires explicit compatibility/version strategy.

Never invalidate an active payment page mid-operation without safe resolution.

# 333. RECONNECT THUNDERING HERD

WebSocket reconnect uses exponential backoff + random jitter:

```text
1s, 2s, 5s, 10s, 20s, 30s max
```

# 334. WEBSOCKET ORIGIN/AUTH

Customer:

- allowed origin;
- active anonymous table session scope.

Staff:

- Django session;
- allowed origin;
- active user;
- role/restaurant scope.

Unknown origin denied.

# 335. WEBSOCKET MUTATION RULE

Critical business mutations remain REST POST.

WebSocket primarily server->client event.

This preserves clearer idempotency, CSRF/auth, logging, and retry behavior.

# 336. PERIODIC RESYNC

Even when WebSocket healthy:

- cashier queue periodic refetch;
- kitchen queue periodic refetch;
- customer refetch on focus.

Canonical DB repairs missed/out-of-order events.

# 337. IDEMPOTENCY RETENTION

```text
Order keys    >=24h
Payment keys  >=7d recommended
```

Payment key is not deleted immediately after commit.

# 338. REQUEST HASH

Same idempotency key + different canonical payload:

```text
409 IDEMPOTENCY_KEY_CONFLICT
```

Repeated conflicts contribute security metric.

# 339. RATE LIMIT LAYERS

1. Nginx gross IP flood control.
2. Application semantic rate limit per session/user.
3. Business rule max one pending order/session.

Shared NAT means IP is not sufficient identity.

# 340. BOT RESPONSE

429 includes retry guidance/`Retry-After` where practical.

Avoid expensive DB work after throttle triggers.

Do not permanently ban entire guest NAT from one burst.

# 341. REQUEST BODY DEFENSE

Nginx + Django enforce:

- max body;
- content type allowlist;
- item count;
- quantity range;
- note length;
- image content validation;
- unknown writable field rejection.

# 342. MENU IMAGE PIPELINE

1. inspect actual content;
2. decode as image;
3. reject malformed/oversized;
4. enforce max pixels;
5. strip metadata where practical;
6. create normalized derivative;
7. random safe filename;
8. serve only non-executable media path.

# 343. LOCAL ASSET POLICY

Bootstrap/JS/icons/fonts required for operation are hosted locally.

No critical CDN dependency, so WAN outage does not break UI.

# 344. DEPENDENCY PINNING

Production build uses deterministic lock.

Avoid unbounded dependency specifications in final image.

Exact tested versions/hashes recorded per release.

# 345. SECURITY GATES IN CI

CI checks:

- Python dependency vulnerability scan;
- container vulnerability scan;
- secret scan;
- static security lint;
- Django checks.

Critical/high exploitable finding blocks release unless formally risk-accepted.

# 346. SUPPLY CHAIN

- dependencies installed at build, not runtime;
- immutable image;
- image SHA/digest recorded;
- no arbitrary curl|sh startup behavior;
- SBOM SHOULD be generated.

# 347. CI/CD REQUIRED STAGES

```text
checkout
lock verification
secret scan
lint/format
static/type checks
Django checks
makemigrations --check
unit tests
PostgreSQL integration tests
concurrency tests
Channels tests
security tests
build image
image scan
migration-upgrade test
staging deploy
staging smoke
Playwright E2E
promote same image digest
```

Production deploy is controlled separate action.

# 348. BUILD ONCE, PROMOTE SAME IMAGE

```text
commit
 -> CI build image digest
 -> staging
 -> approval
 -> exact same digest production
```

Never rebuild different dependency set for production.

# 349. ENVIRONMENT MATRIX

```text
local       developer
ci-test     isolated automated
staging     production-like
production  live restaurant
dr-test     isolated restore drill
```

Production data is not copied raw to staging unless sanitized.

# 350. RELEASE RECORD

Every release records:

```text
version
git SHA
image digest
migration head
risk level
backup ID/status
operator
deploy timestamp
smoke result
rollback version
```

# 351. RELEASE RISK

LOW:

- copy/UI noncritical.

MEDIUM:

- business feature without destructive schema.

HIGH:

- auth;
- payment;
- order state;
- migration;
- service worker;
- network/TLS.

HIGH requires staging E2E, security/concurrency relevant tests, fresh backup confirmation.

# 352. MIGRATION — EXPAND/CONTRACT

Avoid destructive single release.

Example:

```text
Release A: add nullable/new structure, code supports old+new
Backfill: batch
Release B: switch reads/writes
Release C: remove old after verified unused
```

This supports blue-green and rollback compatibility.

# 353. INDEX MIGRATION

Large production index SHOULD use PostgreSQL concurrent creation where appropriate.

Django migration must respect non-transactional requirement of `CREATE INDEX CONCURRENTLY`.

Inspect migration SQL before deploy.

# 354. LARGE BACKFILL

- batch;
- idempotent;
- checkpointable;
- no giant transaction;
- throttle during peak;
- monitor DB load.

# 355. MIGRATION PREFLIGHT

Before production:

1. backup fresh;
2. disk healthy;
3. no problematic long transaction;
4. SQL/locks reviewed;
5. expected duration known;
6. code compatibility known;
7. rollback/forward-fix known;
8. maintenance window if needed.

# 356. BLUE-GREEN WEB DEPLOY

```text
Nginx
  -> Blue current
  -> Green new, internal only
```

Flow:

1. start green;
2. readiness pass;
3. compatible migration;
4. internal smoke;
5. switch upstream;
6. observe;
7. stop blue after soak.

Database schema must support both during overlap.

# 357. CELERY DEPLOY COMPATIBILITY

Task payload uses versioned primitives/IDs.

Old and new workers may overlap briefly.

Breaking task contract requires queue-drain/migration plan.

# 358. SERVICE WORKER RELEASE

Do not blindly force reload during payment.

Normal:

- new SW waits;
- UI indicates update;
- activation at safe point.

Critical security fix can accelerate with tested policy.

# 359. ROLLBACK

Application:

- switch Nginx to previous compatible image;
- restore previous worker if needed.

Database:

- prefer forward-fix;
- destructive migration requires explicit restore plan.

Static previous release retained during rollback window.

# 360. DEPLOY WINDOW

Normal deployment outside meal peak.

Staff aware.

Manual fallback ready.

Security emergency may deploy sooner.

# 361. POST-DEPLOY SMOKE

Verify:

1. liveness;
2. readiness;
3. public menu;
4. cashier auth;
5. WebSocket;
6. Celery/Beat;
7. outbox drains;
8. metrics;
9. error rate;
10. no fake financial production transaction.

# 362. FEATURE FLAGS

SHOULD for risky UI/report rollout.

Flag cannot disable security/business invariants.

Every flag has owner/default/removal date.

# 363. SLO

Initial design objectives during opening hours:

```text
Availability                >=99.5%
Common read p95             <=500 ms healthy local LAN
Critical mutation p95       <=1000 ms
Realtime event p95          <=2 s when healthy
Acknowledged financial loss 0 tolerated by design
```

Measure before claiming.

# 364. SLI

Availability excludes only explicitly documented planned maintenance.

Notification latency measured from DB/outbox commit to client receive.

Financial correctness measured via reconciliation/integrity tests.

# 365. PERFORMANCE BUDGET

Customer:

- small initial JS/CSS;
- lazy menu images;
- no unnecessary SPA bundle;
- compressed text assets.

DB:

- bounded hot-path query count;
- `select_related`/`prefetch_related`;
- indexed queue queries.

# 366. SOAK TEST

Before go-live run representative workload >=8 hours.

Watch:

- memory growth;
- DB connections;
- Redis memory;
- task backlog;
- WebSocket reconnect;
- disk/log growth;
- error trend.

# 367. CHAOS TEST MATRIX

Controlled staging tests:

- kill web_a;
- kill web_b one at time;
- restart Redis realtime;
- restart Redis jobs;
- stop worker;
- stop Beat;
- disconnect WAN;
- restart Nginx;
- restart PostgreSQL;
- induce delayed DB;
- drop WebSocket;
- near-full test disk.

# 368. WAN OUTAGE — MUST PASS

Disconnect ISP while LAN remains.

Expected:

- local DNS resolves;
- HTTPS valid;
- customer menu/order works;
- cashier works;
- kitchen works;
- cash payment works;
- local backup works;
- offsite sync defers safely;
- UI indicates WAN degraded only to staff.

This is key acceptance test for project context.

# 369. ROUTER/AP FAILURE

Application cannot compensate for total LAN failure.

Operations SHOULD maintain:

- config backup;
- static/reserved server IP;
- documented recovery;
- spare router/AP for serious production use.

# 370. DISK FULL

Prevent with:

- rotation;
- retention;
- alerts;
- backup volume separation.

Threshold:

```text
80% warning
90% urgent
```

Never auto-delete financial/audit data to free disk.

# 371. LONG TRANSACTION ALERT

Monitor long/idle-in-transaction sessions because they can block vacuum/migration/locks.

# 372. DEADLOCK HANDLING

PostgreSQL deadlock rolls back transaction.

Service:

- logs metric;
- can retry limited times only if mutation idempotent;
- jitter;
- no infinite retry;
- repeated pattern triggers engineering review.

# 373. OUTBOX DEAD LETTER

DEAD event:

- alert;
- canonical DB remains valid;
- polling works;
- operator may audited requeue after root cause fixed.

# 374. CACHE FAILURE

Redis cache unavailable:

- slower reads accepted;
- DB fallback where safe;
- order/payment meaning unchanged.

Cache failure must not become business logic failure.

# 375. CACHE VERSIONING

```text
resto:{env}:{cache_version}:...
```

Admin catalog update invalidates cache after commit.

TTL bounds missed invalidation.

# 376. BUSINESS CONFIG VALIDATION

Examples:

```text
tax 0..100
service charge 0..100
pending TTL 1..120
max items 1..100
max qty 1..100
```

Config changes audited.

# 377. MONEY MODULE

Centralize all monetary arithmetic.

```text
Decimal only
quantize 0.01
explicit rounding mode
```

Same logic used order/payment/report.

# 378. TAX/SERVICE SNAPSHOT

Historical payment/receipt stores applied rate/formula inputs.

Never recalculate old sale with current configuration.

If local tax rule not confirmed, default rate is zero; do not invent tax policy.

# 379. CANCELLATION AFTER CONFIRM

Customer cannot cancel confirmed order.

Cashier/admin rules:

- before PREPARING: cancel with reason;
- after PREPARING: admin/permissioned exception with waste/operational reason.

Every cancellation audited.

# 380. CANCELLATION REASON CODES

```text
CUSTOMER_REQUEST
DUPLICATE
ITEM_UNAVAILABLE
WRONG_TABLE
CASHIER_ERROR
PENDING_TIMEOUT
SYSTEM_RECOVERY
OTHER
```

# 381. ITEM-LEVEL COMPLEXITY BOUNDARY

Baseline production keeps order-level lifecycle.

If one item must change after confirm, preferred audited approach:

- cancel order if still safe;
- create replacement order.

Partial item void is a future explicit design, not ad-hoc mutation.

# 382. TABLE PHYSICAL PRESENCE

Cashier opening table is primary physical presence anchor.

Optional future stronger controls:

- rotating PIN;
- staff activation QR;
- NFC.

# 383. PUBLIC SESSION SECURITY

New table session creates new public scoped token.

Closed session token cannot mutate.

QR token alone is insufficient without active table session.

# 384. CUSTOMER VISIBILITY

Customer sees only current table session:

- table display;
- own/current session orders;
- current status;
- bill summary.

No old session, other table, staff details, audit.

# 385. QR TOKEN HYGIENE

Recommended flow:

```text
GET /t/{qr_token}
-> validate table
-> bind anonymous server-side session
-> redirect to clean /customer/menu/
```

This reduces QR token exposure in browser history/referrer/access logs.

# 386. CLIENT CART

Cart is convenience only.

Scope by active table session.

On session close/rebind:

- invalidate/clear cart.

Server revalidates everything on submit.

# 387. MULTIPLE TABS

Same browser tabs may submit simultaneously.

Idempotency + pending-order business constraint prevents duplicate logical order.

Canonical status from server.

# 388. BILL REQUEST IDEMPOTENCY

Repeated request creates one active bill request/state.

Cashier may acknowledge.

Acknowledged != paid.

# 389. ORDER VS PAYMENT COMPLETION

Keep separate semantics:

- order operational lifecycle;
- payment financial lifecycle;
- table session lifecycle.

Revenue depends payment, not food state.

# 390. TABLE SESSION FINAL STATE

Recommended:

```text
OPEN
BILL_REQUESTED
PAYMENT_PENDING
PAID
CLOSED
CANCELLED
```

Closed session never reopens; new occupancy creates new session.

# 391. TABLE CLEANING

Configurable:

```text
CLOSED -> CLEANING -> AVAILABLE
```

or direct AVAILABLE if restaurant does not use cleaning state.

# 392. HIGH-IMPACT UI CONFIRMATION

Require confirmation/reason for:

- payment void;
- force close;
- QR rotate;
- ordering disable;
- role change.

Backend remains authority regardless modal.

# 393. API VERSION/CONTRACT

Keep `/api/v1/` stable through production stabilization.

OpenAPI generated and validated.

Breaking change creates coordinated version/migration.

# 394. API CONTRACT TESTS

Frontend/backend tests verify response structure and stable error codes.

Do not silently change serializer errors without updating client/tests.

# 395. MIGRATION UPGRADE TEST

CI:

1. build previous release DB schema;
2. seed representative data;
3. apply new migrations;
4. run integrity assertions;
5. run E2E.

Also test fresh install from zero.

# 396. SECURITY PATCH SLA

Targets:

```text
critical/exploited   24–48h as practical
high                 <=7d
medium/low           scheduled
```

Always regression test before deploy unless incident demands emergency path.

# 397. DJANGO VERSION POLICY

Baseline:

```text
Django 5.2.17 LTS or newer 5.2.x security patch
```

Remain on 5.2 LTS during thesis/initial production stabilization unless explicit upgrade project.

# 398. DRF VERSION POLICY

Baseline verified:

```text
Django REST Framework 3.18.0
```

Pin tested version. Read release notes before changes.

# 399. CHANNELS VERSION POLICY

Baseline:

```text
Channels 4.3.2
channels-redis compatible 4.3.x
```

WebSocket auth/reconnect tests mandatory on upgrade.

# 400. CELERY VERSION POLICY

Baseline:

```text
Celery 5.6.3
```

Pin resolved dependencies via lock and test Redis reconnect behavior.

# 401. POSTGRESQL VERSION POLICY

Baseline:

```text
PostgreSQL 18.4+
```

Apply current 18.x minor/security patch after staging validation.

Major upgrade is separate project.

# 402. FRONTEND POLICY

Bootstrap 5.3.x locally hosted + Vanilla JS.

No React/Vue required.

If Node introduced later, lockfile/security/build pipeline becomes mandatory.

# 403. PWA INSTALL IS OPTIONAL UX

Browser usage is core.

Customer never forced to install application.

Installability is enhancement on supported browsers.

# 404. OFFLINE UX

Offline page/menu cache may be viewable with stale warning.

Critical actions disabled:

- submit order;
- confirm;
- kitchen mutation;
- payment;
- table close/open.

No background-sync transaction baseline.

# 405. CACHE STORAGE FAILURE

Service-worker cache write can fail/quota full.

Online app still works.

Cache exception does not crash checkout.

# 406. STAFF RESPONSE CACHE

Sensitive staff/API responses use `no-store` where appropriate.

Authenticated routes excluded from service-worker cache.

# 407. SAME-ORIGIN BASELINE

Frontend and API same origin.

Do not add permissive CORS to solve coding mistakes.

# 408. PROXY HEADER TRUST

Nginx overwrites trusted forwarded headers.

Django trusts only known reverse proxy path.

Never trust client-supplied `X-Forwarded-For` blindly.

# 409. HOST/CSRF ORIGIN

Production uses explicit:

- ALLOWED_HOSTS;
- CSRF_TRUSTED_ORIGINS.

No wildcard baseline.

# 410. HSTS ROLLOUT

Enable after TLS verified.

Increase duration gradually.

Do not preload without subdomain/rollback review.

# 411. SESSION ENGINE

Recommended cached-db if cache acceleration desired:

- DB fallback/durability of session;
- test Redis failure behavior.

Financial data never exists only in session.

# 412. SESSION CLEANUP

Run Django session cleanup periodically.

Monitor session-table growth.

# 413. DOCKER NETWORKS

Separate logical networks:

```text
frontend_net  nginx <-> web
backend_net   web/worker <-> postgres/redis
monitor_net   exporters/monitoring
```

Nginx has no DB credential/connection requirement.

# 414. STATIC CACHE CONTROL

Content-hashed static:

```text
Cache-Control: public, max-age=31536000, immutable
```

HTML/service worker revalidate and are not year-long immutable.

# 415. REMOTE ACCESS

Use VPN + SSH keys.

Never expose PostgreSQL/Redis just for remote debugging.

# 416. SSH HARDENING

Recommended:

```text
PermitRootLogin no
PasswordAuthentication no
AllowUsers explicit
```

Only after break-glass/recovery method confirmed.

# 417. OS PATCHING

Security update policy + reboot runbook.

After reboot verify full service path.

# 418. AUTO-BOOT TEST

Production readiness includes controlled power-cycle test:

- host boots;
- Docker stack starts;
- health passes;
- ordering works without developer manually running commands.

# 419. LOCAL BACKUP ISOLATION

Local backup ideally lives on separate disk/filesystem from primary DB.

One SSD failure cannot destroy both primary and sole backup.

# 420. DISK CAPACITY PLAN

Estimate:

- DB growth;
- media;
- logs;
- backups;
- Docker images;
- temp files.

Maintain 20–30% headroom.

# 421. DOCKER CLEANUP

Retain current + previous known-good image.

Never run unsafe automatic prune against volumes.

# 422. CONTAINER RESTART

Use appropriate restart policy but alert crash loops.

A process restarting every minute is not healthy.

# 423. MIGRATION OWNERSHIP

Exactly one deployment step executes `migrate`.

Web replicas do not independently race migrations on startup.

# 424. STATIC OWNERSHIP

Build/deployment prepares immutable static artifacts.

Normal web startup does not unexpectedly mutate production static state.

# 425. DB DIRECT EDIT

Normal operation never edits order/payment with raw SQL.

Emergency direct DB intervention requires:

- backup;
- incident record;
- exact SQL saved;
- review;
- integrity check.

# 426. BUSINESS INTEGRITY COMMAND

Create:

```text
python manage.py check_business_integrity
```

Checks:

- duplicate active sessions;
- duplicate completed payment;
- negative monetary fields;
- inconsistent state timestamps;
- payment/session mismatch;
- stuck/dead outbox;
- orphan-like anomalies.

Read-only by default.

# 427. DAILY RECONCILIATION COMMAND

```text
python manage.py reconcile_day YYYY-MM-DD
```

Returns:

- digital completed cash;
- approved recovery cash;
- voids;
- expected/count cash;
- variance;
- order/payment counts.

# 428. INCIDENT SEVERITY

SEV-1:

- DB unavailable/corruption;
- order/payment impossible during open hours;
- acknowledged payment/order data loss;
- auth compromise;
- expired TLS blocking clients.

SEV-2:

- realtime down but polling works;
- backup stale;
- high error rate;
- disk critical.

SEV-3:

- cosmetic/noncritical.

# 429. INCIDENT FLOW

```text
Detect
-> classify
-> stabilize
-> communicate staff
-> preserve logs/evidence
-> manual fallback if needed
-> recover
-> integrity check
-> reconcile
-> RCA
-> corrective action
```

# 430. SECURITY INCIDENT

If compromise suspected:

1. isolate affected access;
2. preserve logs;
3. rotate credentials/secrets;
4. invalidate sessions;
5. inspect audit/financial integrity;
6. patch;
7. redeploy;
8. reconcile;
9. document.

# 431. DATABASE CORRUPTION SUSPECTED

Stop/maintenance mode rather than continuing blind writes.

Preserve evidence/copy.

Restore known-good backup if required.

Reconcile receipts/manual records before reopen.

# 432. REDIS INCIDENT

Realtime Redis down:

- polling mode;
- outbox accumulates/retries;
- core DB state valid.

Jobs Redis down:

- expiration/reports delayed;
- core synchronous operations continue;
- worker catches up after recovery.

# 433. MANUAL RECONCILIATION AFTER OUTAGE

1. count numbered tickets;
2. compare kitchen tickets;
3. compare cash ledger;
4. create recovery entries;
5. admin approves;
6. record variance;
7. preserve paper references.

# 434. STAFF TRAINING

Cashier:

- table session;
- confirm/reject;
- conflict handling;
- cash payment/reprint;
- shift close;
- manual fallback.

Kitchen:

- queue/state;
- sold out;
- degraded realtime indicator.

Admin:

- menu/users;
- backup status;
- maintenance;
- recovery;
- audit;
- incident basics.

# 435. PILOT GO-LIVE

Recommended staged rollout:

- staff/internal;
- limited tables;
- all tables after stable.

Track first-week reliability closely.

# 436. FIRST-WEEK METRICS

- order p95;
- cashier-confirm delay;
- rejects;
- duplicate prevention;
- 5xx;
- socket disconnect;
- cash variance;
- backup success;
- staff feedback.

# 437. BUG PRIORITY

P0:

- financial integrity;
- data loss;
- auth bypass;
- unconfirmed order reaches kitchen;
- duplicate payment.

P1:

- ordering blocked or dangerously stale.

P2/P3:

- noncritical UX/cosmetic.

# 438. HOTFIX

Still requires:

- targeted test;
- immutable image build;
- release ID;
- backup if data/schema related;
- post-deploy smoke.

Never edit Python inside running container.

# 439. GIT/RELEASE

`main` remains releasable/protected.

Production release tags:

```text
v2.0.0
v2.0.1
```

Every deploy records SHA/digest.

# 440. AI AGENT PRODUCTION PROHIBITIONS

AI agent must not:

- bypass cashier gate;
- weaken CSRF;
- add broad `csrf_exempt`;
- change money to float;
- expose DB/Redis;
- hardcode secrets;
- delete audit/payment history;
- remove idempotency;
- invent state transitions;
- make destructive migration without migration plan;
- add dependency without reason/test;
- create second writable DB as fake backup.

# 441. AI TASK RESPONSE FORMAT

Every agent task reports:

```text
Files changed
Migration impact
Security impact
Concurrency impact
Idempotency impact
Backward compatibility
Tests added/run
Observability change
Rollback consideration
Known limitations
```

# 442. PRODUCTION TASK TEMPLATE

```text
TASK-ID:
Risk:
PRD refs:
Goal:
Failure modes:
Data model:
Migration:
Concurrency:
Idempotency:
Authorization:
Validation:
Observability:
Metrics/alerts:
Rollback:
Tests:
Acceptance:
Runbook/docs:
```

# 443. PRODUCTION DOD PER FEATURE

In addition to functional acceptance:

- security reviewed;
- concurrency reviewed;
- idempotency reviewed;
- migration safe;
- observability added;
- error code stable;
- negative tests;
- rollback considered;
- documentation/runbook updated if operational behavior changes.

# 444. PRODUCTION TEST GATE

Mandatory before go-live:

```text
unit
integration PostgreSQL
concurrency
permissions/security
E2E happy path
fake order
same-key duplicate order
double payment
PWA offline/cache
WebSocket + polling fallback
migration upgrade
load smoke
WAN outage
restore drill
```

# 445. SECURITY CONFIG TEST

Automated assertions:

- DEBUG false in production settings;
- unknown Host rejected;
- secure cookie config;
- admin/customer privilege boundaries;
- traceback absent from 500;
- demo credentials absent.

# 446. CONCURRENCY — PAYMENT VS CLOSE

One request pays while another closes.

Expected:

- locks ensure deterministic valid final state;
- never CLOSED unpaid due race;
- loser conflict/refetch.

# 447. CONCURRENCY — CANCEL VS PREPARE

Cashier cancel and kitchen start simultaneously.

Exactly one legal transition wins.

No state corruption.

# 448. LOAD TEST — REALTIME

Test ~300 sockets + realistic order events.

Measure:

- event p95;
- Redis memory;
- reconnect behavior;
- HTTP latency impact.

# 449. LOAD TEST — ORDER SPIKE

Simulate:

- 50 order submit/min;
- menu reads;
- cashier queue;
- kitchen queue;
- payment load.

No invariant violation; p95 within target.

# 450. CHAOS — REDIS REALTIME

Kill realtime Redis.

Expected:

- confirmed DB changes remain;
- outbox backlog;
- polling catches canonical state;
- alert;
- Redis restore;
- dispatcher drains;
- duplicate event harmless.

# 451. CHAOS — WEB INSTANCE

Kill web_a.

Nginx routes new traffic to web_b.

Affected sockets reconnect with jitter.

No committed transaction loss.

# 452. CHAOS — ABRUPT HOST REBOOT

Controlled staging:

- create committed records;
- abrupt restart simulation;
- PostgreSQL recovery;
- stack auto-start;
- integrity command;
- verify committed data.

# 453. RESTORE ACCEPTANCE

Successful restore must include:

- order;
- payment;
- cashier shift;
- audit;
- table session;
- menu/media;
- current migration state.

# 454. PRODUCTION DATABASE CHECKLIST

- [ ] PostgreSQL 18.4+ current minor.
- [ ] SCRAM.
- [ ] private network.
- [ ] runtime non-superuser.
- [ ] migrator separate.
- [ ] backup/monitor roles.
- [ ] psycopg pool.
- [ ] connection budget.
- [ ] statement/lock timeout.
- [ ] autovacuum enabled.
- [ ] backup verified.
- [ ] monitoring.
- [ ] headroom.

# 455. PRODUCTION DJANGO CHECKLIST

- [ ] Django 5.2.17+ 5.2.x security patch.
- [ ] DEBUG false.
- [ ] secret external.
- [ ] explicit hosts/origins.
- [ ] secure cookies.
- [ ] CSRF.
- [ ] CSP/security headers.
- [ ] `check --deploy` pass.
- [ ] ASGI server.
- [ ] CONN_MAX_AGE 0 + pool.
- [ ] RBAC.
- [ ] idempotency.
- [ ] outbox.
- [ ] health/metrics/logs.

# 456. PRODUCTION PWA CHECKLIST

- [ ] HTTPS.
- [ ] manifest.
- [ ] service worker.
- [ ] versioned caches.
- [ ] staff/auth routes bypass cache.
- [ ] POST network-only.
- [ ] offline warning.
- [ ] no false success.
- [ ] update UX.
- [ ] browser fallback.
- [ ] stale client compatibility.

# 457. PRODUCTION CASH CHECKLIST

- [ ] cashier shift open.
- [ ] server-derived bill.
- [ ] Decimal.
- [ ] payment idempotency.
- [ ] session/shift lock.
- [ ] immutable receipt snapshot.
- [ ] reprint.
- [ ] explicit void.
- [ ] shift close/count.
- [ ] variance.
- [ ] reconciliation.

# 458. PRODUCTION BACKUP CHECKLIST

- [ ] logical backup.
- [ ] PITR strategy documented/enabled for target RPO.
- [ ] media backup.
- [ ] encrypted off-site.
- [ ] checksum/manifest.
- [ ] backup alert.
- [ ] restore drill.
- [ ] recovery key custody.
- [ ] retention.

# 459. PRODUCTION OPERATIONS CHECKLIST

- [ ] UPS.
- [ ] wired edge.
- [ ] VLAN/firewall.
- [ ] NTP.
- [ ] TLS renewal.
- [ ] disk/SMART alerts.
- [ ] cold-spare plan.
- [ ] staff SOP.
- [ ] manual tickets.
- [ ] incident runbook.
- [ ] support ownership.

# 460. REPOSITORY PRODUCTION STRUCTURE

Add:

```text
infra/
  compose/
  nginx/
  postgres/
  redis/
  monitoring/
  scripts/
  systemd/
docs/production/
  topology.md
  network.md
  tls.md
  secrets.md
  backup.md
  restore.md
  deployment.md
  rollback.md
  observability.md
  incident-response.md
  manual-fallback.md
  staff-sop.md
  go-live.md
```

# 461. DJANGO APP ADDITIONS

```text
apps/operations/
  business_hours
  maintenance
  cashier_shifts
  recovery_entries

apps/events/
  outbox
  dispatch
```

# 462. CRITICAL SERVICES LIST

```text
open_table_session()
submit_customer_order()
confirm_order()
reject_order()
cancel_order()
start_preparing()
mark_ready()
mark_served()
request_bill()
open_cashier_shift()
complete_cash_payment()
void_payment()
close_cashier_shift()
close_table_session()
create_recovery_entry()
approve_recovery_entry()
set_ordering_enabled()
rotate_table_qr()
```

Each documents permissions, lock set, precondition, audit, outbox, error codes.

# 463. OUTBOX SERVICE CONTRACT

```text
record_domain_event(
  aggregate_type,
  aggregate_id,
  aggregate_version,
  event_type,
  payload
)
```

Called inside current business transaction only.

# 464. PAYMENT LOCK SET

Conceptual:

```text
BEGIN
lock CashierShift
lock TableSession
lock existing payment rows/business key
calculate bill
validate
create payment
receipt snapshot
audit
outbox
COMMIT
```

# 465. IDEMPOTENCY DB RACE

Unique DB constraint is final protection.

If two requests simultaneously insert same key:

- one succeeds;
- loser receives IntegrityError;
- service exits transaction correctly;
- load existing idempotency record;
- compare request hash;
- return same result or 409 conflict.

# 466. AUDIT + OUTBOX ATOMIC ORDER

Inside transaction:

```text
domain mutation
state history
audit
outbox
commit
```

If mandatory audit/outbox write fails, critical mutation rolls back.

# 467. METRICS FAILURE

Metric/monitoring emission cannot roll back successful payment.

Reports always derive canonical DB.

# 468. SERVER TIME AUTHORITY

Official timestamps are server/database generated.

Client cannot choose `paid_at`, `confirmed_at`, or `created_at`.

Manual recovery `occurred_at` is explicit user-supplied historical field and audited.

# 469. BUSINESS DAY QUERY

“Today” uses Asia/Dili boundaries converted to UTC.

Test midnight transitions.

# 470. CSV EXPORT SECURITY

Prevent spreadsheet formula injection for cells beginning special formula characters.

Large export asynchronous and temporary file expires.

# 471. REPORT LOAD ISOLATION

Heavy reports cannot starve order path.

Use:

- index;
- bounded filters;
- background export;
- separate queue;
- query timeout.

# 472. DB CONNECTION RESERVE

Do not consume all `max_connections` with web pools.

Keep reserve for:

- migrator;
- backup;
- monitoring;
- emergency admin.

Example planning, not fixed config:

```text
max_connections 100
normal app budget <=60–70
reserve >=20
```

# 473. WEB INSTANCE COUNT

Baseline two web instances for restart redundancy.

Do not scale process count without considering DB pool multiplication.

# 474. ASYNC CONSUMER RULE

No blocking DB/file/network call directly on event loop.

Use Channels/Django supported async wrappers.

Long-lived consumers manage old DB connections appropriately.

# 475. HEALTH ENDPOINTS

`/health/live`:

- process alive.

`/health/ready`:

- DB reachable;
- migration compatible;
- critical dependencies status.

Redis realtime outage may be DEGRADED while core ready remains true.

PostgreSQL outage => ready false.

# 476. MAINTENANCE MODE

Modes:

```text
OFF
CUSTOMER_READ_ONLY
FULL
```

Read-only can allow menu but block new customer mutations while staff safely finishes existing operations according incident policy.

# 477. GRACEFUL SHUTDOWN

Web stops new connections then drains bounded in-flight work.

Celery warm shutdown.

PostgreSQL stopped last during planned host maintenance.

# 478. REQUEST ID VS IDEMPOTENCY

`X-Request-ID` = observability.

`Idempotency-Key` = logical mutation identity.

They are not interchangeable.

# 479. CUSTOMER ERROR UX

Network timeout after submit:

```text
Status pesanan belum dapat dipastikan.
Sistem sedang memeriksa pesanan Anda.
```

Client retries same idempotency key/refetches.

Never says “failed” just because response was lost.

# 480. STAFF CONFLICT UX

```text
Data telah diproses oleh pengguna lain. Tampilan sedang diperbarui.
```

Refetch canonical state.

# 481. SUPPORT REFERENCE

User-facing unexpected error includes short reference/request ID.

No stack trace.

# 482. OPERATOR DASHBOARD

Protected diagnostics:

```text
App version
DB health
Realtime health
Jobs health
WAN status
Outbox backlog
Last backup age
Disk usage
TLS days remaining
Oldest pending order
```

No secrets.

# 483. WAN STATUS

Staff distinguishes:

```text
LAN SERVER ONLINE
INTERNET OFFLINE
```

WAN offline alone does not imply ordering outage.

# 484. CUSTOMER NETWORK MODE

For private local-edge deployment, customer SHOULD join restaurant Wi-Fi.

If public internet access to local edge is later desired, it requires explicit reverse-proxy/tunnel architecture and security review.

# 485. CAPTIVE PORTAL

Test guest Wi-Fi captive portal with HTTPS ordering.

Do not use TLS interception.

Simplest reliable design is guest Wi-Fi with normal internet/local routing after acceptance.

# 486. DOMAIN/DNS OWNERSHIP

Production handover records:

- legal/operational owner of domain;
- DNS account custody;
- certificate automation credentials;
- renewal procedure.

Do not leave production dependent on undocumented personal student account.

# 487. BREAK-GLASS ADMIN

One emergency admin credential stored offline securely.

Not used daily.

Use triggers audit/incident note and credential rotation afterward.

# 488. PRODUCTION DATA AND AI

AI agents receive synthetic/sanitized data.

Never send:

- production secret;
- raw cookies/session tokens;
- backup keys;
- unnecessary staff PII.

# 489. ACCESS LOG TOKEN HYGIENE

Prefer QR token exchange + redirect to clean URL.

Strict Referrer-Policy and no third-party assets reduce token leak.

Logs containing tokens have restricted access/retention.

# 490. RECONCILIATION AFTER PAYMENT PRINT FAILURE

Receipt printing occurs after commit.

Print failure does NOT repeat payment.

Reprint same immutable receipt.

# 491. CLOSE-OF-DAY SOP

Optional but recommended:

1. close remaining tables;
2. close cashier shifts;
3. review recovery/manual records;
4. reconcile cash;
5. review voids;
6. verify backup status;
7. generate daily report.

# 492. STALE SESSION ALERT

Table session open beyond configured hours is flagged for staff review.

Never auto-close unpaid session blindly.

# 493. STALE SHIFT ALERT

Cashier shift beyond configured duration is flagged.

Requires reconciliation before normal close.

# 494. OUTBOX RETENTION

DISPATCHED rows retained for diagnostic window, then cleaned by policy.

PENDING/DEAD not silently deleted.

# 495. IDEMPOTENCY CLEANUP

Only after retention window and safe terminal state.

Payment records retained longer than order retry keys.

# 496. GO-LIVE BLOCKERS — P0

Any item blocks production:

- DEBUG true;
- no HTTPS;
- no backup;
- restore never tested;
- DB/Redis exposed;
- cashier gate bypassable;
- non-idempotent payment;
- non-idempotent customer order;
- concurrency test failing;
- no manual fallback;
- local edge without UPS;
- certificate renewal unknown;
- migration drift;
- unresolved critical/high exploitable security issue;
- E2E fail.

# 497. PRODUCTION ROADMAP v2

## P0 Architecture Freeze

- local edge;
- cash-only scope;
- cashier gate;
- outbox;
- Postgres 18.4+;
- Redis split;
- cashier shift;
- manual recovery.

## P1 Infrastructure

- Docker;
- Nginx;
- TLS;
- DB;
- Redis x2;
- metrics/logs.

## P2 Core Domain

- accounts;
- tables/sessions;
- catalog;
- orders;
- kitchen;
- payment;
- shifts.

## P3 Reliability

- constraints;
- locks;
- idempotency;
- outbox;
- retries;
- versioning.

## P4 PWA

- manifest;
- service worker;
- secure cache;
- offline/update UX.

## P5 Realtime

- Channels;
- authorization;
- dispatcher;
- polling;
- reconnect jitter.

## P6 Operations

- backup;
- PITR;
- monitoring;
- alerts;
- manual fallback;
- recovery entry.

## P7 Security

- network;
- secret;
- CSP;
- CSRF;
- RBAC;
- scanner/gates.

## P8 Production QA

- concurrency;
- load;
- soak;
- chaos;
- WAN outage;
- reboot;
- restore.

## P9 Go-live

- pilot;
- staff training;
- QR;
- UPS;
- preflight;
- monitoring/support.

# 498. VERIFIED TECHNOLOGY BASELINE — 2026-08-13

```text
Python                       3.13.x
Django                       5.2.17 LTS
Django REST Framework        3.18.0
Channels                     4.3.2
channels-redis               compatible 4.3.x
Daphne                       compatible 4.2.x
Celery                       5.6.3
psycopg                      3.x + pool extra
PostgreSQL                   18.4+
Redis                        supported stable
Nginx                        supported stable
Bootstrap                    5.3.x
```

Test/dev:

```text
pytest
pytest-django
factory_boy
Playwright
coverage
Ruff
Black
pre-commit
Python dependency vulnerability scanner
container vulnerability scanner
secret scanner
```

Operations:

```text
Docker Engine
Docker Compose v2
Prometheus-compatible metrics
Grafana
Alertmanager
Node/PostgreSQL/Redis exporters
```

Exact dependency versions are pinned by tested release lock.

# 499. SOURCE-VERIFIED ENGINEERING NOTES

- Django 5.2 LTS remains supported through April 2028 and the current baseline patch is 5.2.17.
- Official Django deployment guidance requires production checks, production ASGI/WSGI server, protected secrets, `DEBUG=False`, correct hosts, backups, HTTPS, static/media handling, and logging.
- Official Django DB guidance states ASGI should not use persistent connections; use backend connection pooling instead. Django 5.2 supports psycopg pool via database `OPTIONS`.
- `transaction.atomic()` guarantees commit/rollback boundaries, and critical transactions must stay short.
- `select_for_update()` locks selected rows until transaction end on PostgreSQL and is used for critical concurrency.
- PostgreSQL 18.4 is the selected current security/minor floor for the production baseline.
- DRF 3.18.0, Channels 4.3.2, and Celery 5.6.3 are baseline versions verified at the document review date.

# 500. PRODUCTION PRE-FLIGHT COMMAND

Create:

```text
python manage.py production_preflight
```

Checks:

- APP_ENV production;
- DEBUG false;
- production not SQLite;
- secret not placeholder;
- allowed hosts/origins;
- DB version/support floor;
- migration head;
- Redis dependencies;
- no demo accounts;
- admin exists;
- business config valid;
- critical integrity checks.

Production deploy requires both:

```text
python manage.py check --deploy
python manage.py production_preflight
```

# 501. PRODUCTION STARTUP GUARDS

Production refuses dangerous configuration:

- default/known placeholder secret;
- SQLite;
- DEBUG true;
- empty ALLOWED_HOSTS;
- demo seed flag;
- missing critical encryption/DB secret.

# 502. SEED DEMO GUARD

`seed_demo` refuses `APP_ENV=production`.

Production has separate `bootstrap_production` flow with no default password.

# 503. BACKUP SCRIPT SAFETY

Backup implementation:

1. fail-fast shell mode;
2. write unique temp file;
3. dump;
4. check exit/status;
5. checksum;
6. encrypt offsite artifact;
7. atomic final rename;
8. manifest;
9. only then retention cleanup.

Never delete old valid backup before new one verifies.

# 504. RESTORE SCRIPT SAFETY

Default restore target is isolated DR database/host.

Refuse overwrite production unless explicit emergency procedure.

# 505. BACKUP MANIFEST

```text
backup_id
timestamp
DB version
app version
migration head
file checksum
size
encryption status
offsite synced
```

# 506. OFFSITE DELETE PROTECTION — SHOULD

If storage supports versioning/object lock, enable it so compromised app host cannot immediately destroy every backup.

# 507. ALERT TEST

Before go-live simulate:

- web down;
- backup stale;
- disk threshold;
- Redis realtime down;
- certificate warning if practical.

Confirm operator receives/observes alerts.

# 508. STAFF STATUS BANNER

Cashier/kitchen simple status:

```text
SYSTEM HEALTHY
REALTIME POLLING
WAN OFFLINE
```

No infrastructure secrets displayed.

# 509. CUSTOMER STATUS COPY

Only customer-relevant messages:

```text
Offline
Ordering temporarily paused
Waiting cashier confirmation
Session closed
```

# 510. PRODUCTION API THROTTLE CONFIG

Server settings:

```text
PUBLIC_QR_RESOLVE_RATE
PUBLIC_MENU_RATE
ORDER_SUBMIT_RATE_PER_SESSION
BILL_REQUEST_RATE_PER_SESSION
LOGIN_FAIL_RATE
```

If business-configurable, changes audited.

# 511. SESSION/COOKIE SECURITY

No auth token in URL for staff.

Customer anonymous table binding scoped server-side.

Secure cookie + SameSite policy tested.

# 512. QR ENTROPY

Use cryptographic `secrets` generator.

Never sequential ID/base64 timestamp/random.random.

# 513. MENU PRICE VERSION

Public menu includes price/update version.

Cart sends last-seen version/price solely for stale detection.

Server remains price authority.

# 514. PRICE_CHANGED FLOW

Server 409 returns affected items/current prices.

Customer must explicitly reconfirm.

New logical accepted submit uses new idempotency key.

# 515. SOLD_OUT FLOW

409 identifies unavailable item.

Do not silently create partial order.

Customer edits/reconfirms cart.

# 516. PAYMENT ATOMIC FLOW v2

```text
BEGIN
lock CashierShift
lock TableSession
lock/check completed Payment
recalculate bill from canonical orders
validate cash tender
create Payment COMPLETED
store receipt snapshot
update TableSession PAID
update business state as policy
write audit
write outbox
COMMIT
return payment/receipt result
```

# 517. RECEIPT PRINT

Printing happens after commit.

Reprint is read-only; cannot duplicate payment.

# 518. PRODUCTION SUCCESS CRITERIA

Must demonstrate:

1. happy path;
2. fake-order gate;
3. duplicate order immunity;
4. duplicate payment immunity;
5. race safety;
6. price tampering blocked;
7. sold-out handling;
8. realtime Redis outage -> polling;
9. WAN outage operation;
10. one web instance failure;
11. reboot recovery;
12. backup success;
13. restore success;
14. manual fallback + recovery;
15. shift reconciliation;
16. security preflight;
17. load target;
18. soak target;
19. alerts;
20. rollback;
21. staff training;
22. no P0 blockers.

# APPENDIX K — PRODUCTION REQUEST PATH

```text
Device
  |
 HTTPS 443
  |
Nginx
  |
Django/Daphne A/B
  |
  +---- PostgreSQL [CANONICAL]
  +---- Redis Realtime [EPHEMERAL]
  +---- Redis Jobs [ASYNC]
  |
Transactional Outbox
  |
Dispatcher -> Channels -> WebSocket
```

# APPENDIX L — PRODUCTION NETWORK

```text
WAN
 |
Router
 +----- Guest VLAN ----- HTTPS ----+
 +----- Staff VLAN ----- HTTPS ----+--> Nginx
 +----- Mgmt VLAN ------ SSH/VPN --+
                                  |
                              Server VLAN
                         +--------+--------+
                         |        |        |
                        Web    PostgreSQL Redis
```

Guest cannot reach DB/Redis/SSH.

# APPENDIX M — OUTBOX SEQUENCE

```text
Cashier    Django      PostgreSQL     Dispatcher     Redis      Client
  | confirm |              |              |            |          |
  |-------->| BEGIN        |              |            |          |
  |         | lock/update->|              |            |          |
  |         | audit------->|              |            |          |
  |         | outbox------>|              |            |          |
  |         | COMMIT------>|              |            |          |
  |<--------| 200          |              |            |          |
  |         |              |<--claim------|            |          |
  |         |              |              |--publish-->|--------->|
  |         |              |<--mark sent--|            |          |
```

If Redis is down, event remains pending; polling still reads canonical DB.

# APPENDIX N — WAN OUTAGE

```text
ISP DOWN
 -> LAN remains
 -> local DNS resolves edge
 -> trusted TLS still valid
 -> PWA/API local works
 -> DB/payments local work
 -> local backup continues
 -> offsite sync waits
 -> WAN returns
 -> offsite sync resumes
```

# APPENDIX O — MANUAL FALLBACK

```text
TOTAL EDGE/LAN FAILURE
 -> numbered paper ticket
 -> kitchen paper ticket
 -> cash ledger
 -> restore system
 -> integrity check
 -> recovery entry
 -> admin approval
 -> reconciliation
```

# APPENDIX P — TRUST BOUNDARIES

```text
UNTRUSTED
customer browser / QR possession / guest network / all request fields

LIMITED TRUST
cashier / kitchen authenticated sessions

PRIVILEGED
admin

HIGHLY PRIVILEGED
host operator / DB migrator / backup key custodian
```

# APPENDIX Q — RELEASE MANIFEST TEMPLATE

```text
Release:
Git SHA:
Image digest:
Date:
Operator:
Django:
DRF:
Channels:
Celery:
PostgreSQL:
Migration head:
Backup ID:
Risk:
Staging E2E:
Concurrency:
Security scan:
Deploy start/end:
Smoke:
Rollback image:
Notes:
```

# APPENDIX R — INCIDENT TEMPLATE

```text
Incident ID:
Start/detected:
Severity:
Affected users/transactions:
Symptoms:
Immediate mitigation:
Manual mode used:
Recovery:
Integrity check:
Cash reconciliation:
Root cause:
Corrective/preventive action:
Owner/due date:
```

# APPENDIX S — RESTORE DRILL TEMPLATE

```text
Drill ID:
Backup ID/timestamp:
App/DB version:
Restore host:
Start/end:
RTO/RPO achieved:
Row checks:
Payment checks:
Audit checks:
Media checks:
Smoke result:
Issues:
PASS/FAIL:
```

# APPENDIX T — FINAL GO-LIVE PRE-FLIGHT

```text
[ ] Edge hardware healthy
[ ] UPS tested
[ ] LAN/VLAN/firewall tested
[ ] Local DNS works
[ ] TLS valid/renewal monitored
[ ] DB healthy/private/current
[ ] Redis private
[ ] Disk <80%
[ ] Backup fresh
[ ] Restore drill passed
[ ] DEBUG false
[ ] check --deploy pass
[ ] production_preflight pass
[ ] migrations current
[ ] no demo users/secrets
[ ] staff accounts ready
[ ] QR tested
[ ] PWA tested
[ ] duplicate tests pass
[ ] payment race tests pass
[ ] realtime/polling pass
[ ] WAN outage pass
[ ] monitoring/alerts pass
[ ] manual forms ready
[ ] staff SOP/training done
[ ] rollback image retained
```

# APPENDIX U — FINAL PRODUCTION COMMANDMENT

PostgreSQL adalah canonical truth.

Redis boleh gagal; order/payment tidak boleh berubah makna.

WebSocket boleh gagal; polling/outbox harus memulihkan pengalaman.

WAN boleh putus; local-edge core tetap berjalan.

Client boleh dimanipulasi; server menentukan harga, status, permission, dan payment.

Request boleh retry; idempotency mencegah duplicate.

Dua staff boleh klik bersamaan; transaction + row lock + constraint menentukan satu canonical result.

Notification boleh gagal; outbox menyimpan event intent sampai dispatch berhasil atau masuk dead-letter dan alert.

Hardware boleh gagal; backup, cold spare, dan restore runbook menyediakan recovery.

Seluruh digital system boleh gagal; manual numbered-ticket fallback menjaga restoran tetap dapat beroperasi dan kemudian direkonsiliasi secara audited.

Backup hanya dianggap nyata setelah restore drill berhasil.

Deployment hanya dianggap aman bila previous known-good image, migration compatibility, dan rollback/forward-fix sudah dipikirkan sebelum go-live.

AI agent boleh murah; correctness harus dijaga oleh PRD, database constraints, tests, CI, security boundaries, monitoring, dan production guardrails.

**END OF PRD v2.0.0 — PRODUCTION-READY ENGINEERING BASELINE**
