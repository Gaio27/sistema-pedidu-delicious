import os
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User, Role
from apps.restaurants.models import Restaurant
from apps.tables.models import RestaurantTable, TableStatus, TableSession, SessionStatus
from apps.tables.services import open_table_session
from apps.catalog.models import Category, MenuItem, ItemAvailability

class Command(BaseCommand):
    help = "Seeds comprehensive production demo data for Celvass Resto & Bar (Dili, Timor-Leste)"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding Celvass Resto & Bar demo data..."))

        with transaction.atomic():
            # 1. Restaurant Profile
            resto, _ = Restaurant.objects.update_or_create(
                id=Restaurant.objects.first().id if Restaurant.objects.exists() else None,
                defaults={
                    "name": "Celvass Resto & Bar",
                    "legal_name": "Celvass Resto & Bar Unipessoal Lda",
                    "phone": "+670 7712 9988",
                    "address": "Av. de Portugal, Praia dos Coqueiros, Dili, Timor-Leste",
                    "currency": "USD",
                    "timezone": "Asia/Dili",
                    "tax_percentage": Decimal("0.00"),
                    "is_active": True,
                }
            )

            # 2. Staff Accounts
            admin_user, _ = User.objects.get_or_create(
                username="admin",
                defaults={
                    "email": "admin@celvass.tl",
                    "full_name": "Manager Celvass",
                    "role": Role.ADMIN,
                    "is_staff": True,
                    "is_superuser": True,
                }
            )
            admin_user.email = "admin@celvass.tl"
            admin_user.set_password("admin123")
            admin_user.save()

            cashier_user, _ = User.objects.get_or_create(
                username="cashier",
                defaults={
                    "email": "cashier@celvass.tl",
                    "full_name": "Maria Kasir Celvass",
                    "role": Role.CASHIER,
                    "is_staff": True,
                }
            )
            cashier_user.email = "cashier@celvass.tl"
            cashier_user.set_password("cashier123")
            cashier_user.save()

            kitchen_user, _ = User.objects.get_or_create(
                username="kitchen",
                defaults={
                    "email": "kitchen@celvass.tl",
                    "full_name": "Chef Joao Dapur",
                    "role": Role.KITCHEN,
                    "is_staff": True,
                }
            )
            kitchen_user.email = "kitchen@celvass.tl"
            kitchen_user.set_password("kitchen123")
            kitchen_user.save()

            # 3. Dining Tables
            tables_data = [
                ("T-01", "Meza 01 (Indoor Lounge)", 2, 1),
                ("T-02", "Meza 02 (Indoor Dining)", 4, 2),
                ("T-03", "Meza 03 (Indoor Dining)", 4, 3),
                ("T-04", "Meza 04 (Bar Counter)", 2, 4),
                ("T-05", "Meza 05 (Ocean View)", 4, 5),
                ("T-06", "Meza 06 (Ocean View)", 4, 6),
                ("T-07", "Meza 07 (Terrace Outdoor)", 4, 7),
                ("T-08", "Meza 08 (VIP Family & Bar)", 8, 8),
                ("T-09", "Meza 09 (Beachside Patio)", 4, 9),
                ("T-10", "Meza 10 (Beachside Patio)", 6, 10),
            ]

            tables_map = {}
            for code, name, cap, order in tables_data:
                tbl, _ = RestaurantTable.objects.update_or_create(
                    restaurant=resto,
                    table_code=code,
                    defaults={
                        "display_name": name,
                        "capacity": cap,
                        "sort_order": order,
                        "status": TableStatus.AVAILABLE,
                        "is_active": True,
                    }
                )
                tables_map[code] = tbl

            # 4. Multilingual Catalog & Bar Drinks
            catalog_data = [
                {
                    "name": "Pratus Prinsipál (Main Dishes)",
                    "slug": "main-courses",
                    "icon": "bowl-food",
                    "sort": 1,
                    "items": [
                        ("Ikan Saboko Celvass Special", "Ikan kakap laut bakar daun kelapa rempah tamarind & cabai merah Dili.", Decimal("7.50"), "/static/images/menu/ikan-saboko.jpg"),
                        ("Batar Da'an & Pork Ribs", "Jagung manis lembut dimasak kacang merah disajikan dengan iga bakar gurih.", Decimal("8.50"), "/static/images/menu/batar-daan-ribs.jpg"),
                        ("Tukir Daging Sapi Bambu", "Daging sapi empuk bumbu rempah tradisional dipanggang di bumbung bambu.", Decimal("8.00"), "/static/images/menu/tukir-sapi.jpg"),
                        ("Ayam Bakar Rempah Celvass", "Ayam bakar bumbu pedas manis madu khas pesisir pantai Dili.", Decimal("6.00"), "/static/images/menu/ayam-bakar.jpg"),
                        ("Nasi Goreng Seafood Spesial", "Nasi goreng wangi dengan cumi segar, udang laut, telur mata sapi, dan kerupuk.", Decimal("5.00"), "/static/images/menu/nasi-goreng-seafood.jpg"),
                    ]
                },
                {
                    "name": "Seafood & Grill",
                    "slug": "seafood",
                    "icon": "fish",
                    "sort": 2,
                    "items": [
                        ("Cumi Bakar Saus Madu Pedas", "Cumi segar panggang arang dengan olesan saus madu cabai nikmat.", Decimal("7.00"), "/static/images/menu/cumi-bakar.jpg"),
                        ("Udang Jumbo Goreng Mentega", "Udang laut goreng renyah disiram saus mentega bawang putih wangi.", Decimal("8.00"), "/static/images/menu/udang-mentega.jpg"),
                        ("Kepiting Saus Padang Celvass", "Kepiting bakau segar saus kental pedas gurih aroma daun jeruk.", Decimal("11.00"), "/static/images/menu/kepiting-padang.jpg"),
                    ]
                },
                {
                    "name": "Bar Cocktails & Mocktails",
                    "slug": "bar-drinks",
                    "icon": "martini-glass-citrus",
                    "sort": 3,
                    "items": [
                        ("Sunset Celvass Mocktail", "Campuran sari jeruk segar, grenadine, daun mint dingin, dan soda segar.", Decimal("3.50"), "/static/images/menu/sunset-mocktail.jpg"),
                        ("Dili Mojito Lime", "Perasan jeruk nipis segar, daun mint, gula tebu, dan air berkarbonasi dingin.", Decimal("4.00"), "/static/images/menu/dili-mojito.jpg"),
                        ("Tropical Blue Ocean", "Minuman sirup blue curacao non-alkohol dengan perasan lemon dan kelapa muda.", Decimal("3.80"), "/static/images/menu/tropical-blue.jpg"),
                        ("Kafé Timor Organik Ermera", "Kopi arabika asli Timor-Leste seduh espresso pekat harum.", Decimal("2.50"), "/static/images/menu/kafe-timor.jpg"),
                        ("Kelapa Muda Segar Batok", "Air kelapa murni dingin langsung dari batok dengan daging kelapa lembut.", Decimal("2.50"), "/static/images/menu/kelapa-muda.jpg"),
                    ]
                },
                {
                    "name": "Sopa & Kuah (Soups)",
                    "slug": "soups",
                    "icon": "mug-hot",
                    "sort": 4,
                    "items": [
                        ("Caldo Verde Tradisional", "Sup kentang khas Portugis-Timor dengan irisan daun kale segar.", Decimal("4.50"), "/static/images/menu/caldo-verde.jpg"),
                        ("Sup Ikan Laut Kuah Asam", "Sup fillet ikan segar kuah bening asam pedas segar belimbing wuluh.", Decimal("5.50"), "/static/images/menu/sup-ikan-asam.jpg"),
                    ]
                },
                {
                    "name": "Sobremesa & Petiskus (Desserts & Snacks)",
                    "slug": "desserts",
                    "icon": "ice-cream",
                    "sort": 5,
                    "items": [
                        ("Pastel de Nata Português", "Tart telur panggang karamel renyah manis lembut taburan kayu manis.", Decimal("2.50"), "/static/images/menu/pastel-de-nata.jpg"),
                        ("Pisang Goreng Keju Karamel", "Pisang kepok renyah limpahan keju parut cheddar dan karamel madu.", Decimal("3.00"), "/static/images/menu/pisang-keju.jpg"),
                        ("Singkong Goreng Garlic Rempah", "Singkong empuk gurih renyah dengan sambal bawang spesial bar.", Decimal("2.50"), "/static/images/menu/singkong-garlic.jpg"),
                    ]
                }
            ]

            for cat_data in catalog_data:
                category, _ = Category.objects.update_or_create(
                    restaurant=resto,
                    slug=cat_data["slug"],
                    defaults={
                        "name": cat_data["name"],
                        "icon_name": cat_data["icon"],
                        "sort_order": cat_data["sort"],
                        "is_active": True,
                    }
                )

                for idx, (name, desc, price, img_url) in enumerate(cat_data["items"], start=1):
                    item_slug = f"{cat_data['slug']}-{idx}"
                    MenuItem.objects.update_or_create(
                        restaurant=resto,
                        slug=item_slug,
                        defaults={
                            "category": category,
                            "name": name,
                            "description": desc,
                            "price": price,
                            "image_url": img_url,
                            "availability": ItemAvailability.AVAILABLE,
                            "sort_order": idx,
                            "is_featured": idx == 1,
                        }
                    )

            # 5. Open Table 01 session by default for instant testing
            t1 = tables_map.get("T-01")
            if t1:
                active_s = TableSession.objects.filter(table=t1, status__in=[SessionStatus.OPEN, SessionStatus.BILL_REQUESTED]).first()
                if not active_s:
                    open_table_session(table=t1, opened_by=cashier_user, guest_count=2)

        self.stdout.write(self.style.SUCCESS("Celvass Resto & Bar demo data seeded successfully!"))
        self.stdout.write(self.style.SUCCESS(f"Restoran: {resto.name}"))
        self.stdout.write(self.style.SUCCESS("Akun Demo:"))
        self.stdout.write(self.style.SUCCESS(" - Admin   : admin / admin123 (email: admin@celvass.tl)"))
        self.stdout.write(self.style.SUCCESS(" - Kasir   : cashier / cashier123 (email: cashier@celvass.tl)"))
        self.stdout.write(self.style.SUCCESS(" - Dapur   : kitchen / kitchen123 (email: kitchen@celvass.tl)"))
