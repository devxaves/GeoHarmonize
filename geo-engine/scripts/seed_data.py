"""
GeoHarmonize — Seed Data Generator
Generates ~200 parcels with realistic discrepancies for demo purposes.

Usage: python scripts/seed_data.py
Output: geo-engine/sample_data/legacy_cadastral.geojson
        geo-engine/sample_data/new_drone_survey.geojson
        geo-engine/sample_data/revenue_records.csv
"""

import json
import csv
import random
import math
import os
from pathlib import Path

random.seed(42)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "sample_data"
OUTPUT_DIR.mkdir(exist_ok=True)

BASE_LAT = 18.520000
BASE_LON = 73.856000
GRID_SIZE = 20
PARCEL_WIDTH_DEG = 0.000350
PARCEL_HEIGHT_DEG = 0.000280
GAP_DEG = 0.000020

OWNER_NAMES = [
    "Ramesh Kumar Sharma", "Priya Venkataraman", "Amit Singh Patel", "Sunita Devi Yadav",
    "Vijay Prakash Gupta", "Anjali Mohan Desai", "Rajesh Chandra Joshi", "Meena Krishnan Iyer",
    "Suresh Babu Nair", "Kavita Ashok Kulkarni", "Arvind Kumar Mishra", "Pooja Sanjay Bhosale",
    "Manoj Kumar Tiwari", "Rekha Pandit Chavan", "Sanjay Dattatraya Pawar", "Anita Vijay Deshmukh",
    "Prakash Narayan Gupta", "Sunil Kumar Jain", "Deepa Ramesh Kulkarni", "Vivek Anand Shinde",
    "Lakshmi Narayanan", "Raghavendra Prasad", "Savita Ben Sharma", "Nitin Gopalrao Kale",
    "Prakash Chandra Gupta", "Meera Krishnan", "Anil Kumar Agarwal", "Sushma Devi Singh",
    "Rakesh Kumar Verma", "Geeta Rani Pandey", "Mohan Lal Gupta", "Sarita Devi Prasad",
    "Dinesh Kumar Srivastava", "Usha Rani Mishra", "Pankaj Kumar Singh", "Nisha Gupta Sharma",
    "Rahul Dev Pandey", "Seema Kumari Singh", "Vikramaditya Sharma", "Anuradha Joshi",
    "Nagaraj Srinivasan", "Shanti Devi Nagar", "Krishna Kumar Tiwari", "Mala Rani Srivastava",
    "Ganesh Prasad Gupta", "Kamla Devi Prasad", "Hari Shankar Sharma", "Rama Devi Sharma",
    "Shiv Kumar Singh", "Parvati Devi Singh", "Mukesh Kumar Gupta", "Saraswati Devi Gupta",
    "Arun Kumar Sharma", "Nirmala Devi Sharma", "Sachin Tendulkar", "Anjali Bhagwat",
]

LAND_USES = ["residential", "commercial", "agricultural", "industrial", "mixed"]

def generate_cadastral_parcels():
    features = []
    for i in range(GRID_SIZE):
        for j in range(GRID_SIZE):
            idx = i * GRID_SIZE + j
            if idx >= 200:
                break

            lat = BASE_LAT + i * (PARCEL_HEIGHT_DEG + GAP_DEG)
            lon = BASE_LON + j * (PARCEL_WIDTH_DEG + GAP_DEG)

            w = PARCEL_WIDTH_DEG * random.uniform(0.85, 1.0)
            h = PARCEL_HEIGHT_DEG * random.uniform(0.85, 1.0)

            survey_num = f"SY-{142 + idx}"
            plot_num = f"PLT-{idx + 1:03d}"
            prop_id = f"MH-PUNE-{idx + 1:03d}"
            owner = OWNER_NAMES[idx % len(OWNER_NAMES)]
            area = round(w * h * 111320 * 111320 * math.cos(math.radians(BASE_LAT)), 1)
            land_use = LAND_USES[idx % len(LAND_USES)]

            coords = [
                [lon, lat],
                [lon + w, lat],
                [lon + w, lat + h],
                [lon, lat + h],
                [lon, lat],
            ]

            features.append({
                "type": "Feature",
                "properties": {
                    "survey_number": survey_num,
                    "plot_number": plot_num,
                    "property_id": prop_id,
                    "owner_name": owner,
                    "recorded_area_sqm": area,
                    "land_use": land_use,
                    "source_system": "cadastral",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords],
                },
            })

    return {
        "type": "FeatureCollection",
        "name": "legacy_cadastral",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
        },
        "features": features,
    }


def generate_drone_parcels(cadastral_features):
    features = []
    for idx, feat in enumerate(cadastral_features):
        props = feat["properties"]
        geom = feat["geometry"]["coordinates"][0]

        drift_x = random.uniform(-0.000025, 0.000025)
        drift_y = random.uniform(-0.000020, 0.000020)

        new_coords = [[lon + drift_x, lat + drift_y] for lon, lat in geom]

        owner = props["owner_name"]
        if idx % 5 == 0:
            parts = owner.split()
            if len(parts) >= 2:
                owner = f"{parts[0]} {parts[1][0]}. {' '.join(parts[2:])}"
        elif idx % 7 == 0:
            parts = owner.split()
            if len(parts) >= 2:
                owner = f"{parts[0][0]}. {' '.join(parts[1:])}"

        area = props["recorded_area_sqm"] * random.uniform(0.97, 1.03)

        if idx == 50:
            new_coords = [[lon + 0.000050, lat + 0.000040] for lon, lat in geom]
        if idx == 100:
            new_coords = [[lon - 0.000040, lat - 0.000030] for lon, lat in geom]

        if idx == 25:
            new_coords = new_coords[:-1]
            new_coords.append(new_coords[0])

        features.append({
            "type": "Feature",
            "properties": {
                "survey_number": props["survey_number"],
                "plot_number": props["plot_number"],
                "property_id": props["property_id"],
                "owner_name": owner,
                "recorded_area_sqm": round(area, 1),
                "land_use": props["land_use"],
                "source_system": "drone_ori",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [new_coords],
            },
        })

    return {
        "type": "FeatureCollection",
        "name": "new_drone_survey",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
        },
        "features": features,
    }


def generate_revenue_csv(cadastral_features):
    csv_path = OUTPUT_DIR / "revenue_records.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["survey_number", "plot_number", "owner_name", "area_sqm", "land_use", "village", "district", "state"])
        for feat in cadastral_features:
            p = feat["properties"]
            writer.writerow([
                p["survey_number"],
                p["plot_number"],
                p["owner_name"],
                p["recorded_area_sqm"],
                p["land_use"],
                "Pune Ward 01",
                "Pune",
                "Maharashtra",
            ])
    return csv_path


def main():
    print("Generating legacy cadastral parcels...")
    cadastral = generate_cadastral_parcels()
    cadastral_path = OUTPUT_DIR / "legacy_cadastral.geojson"
    with open(cadastral_path, "w", encoding="utf-8") as f:
        json.dump(cadastral, f, indent=2)
    print(f"  Written: {cadastral_path} ({len(cadastral['features'])} parcels)")

    print("Generating drone survey parcels with discrepancies...")
    drone = generate_drone_parcels(cadastral["features"])
    drone_path = OUTPUT_DIR / "new_drone_survey.geojson"
    with open(drone_path, "w", encoding="utf-8") as f:
        json.dump(drone, f, indent=2)
    print(f"  Written: {drone_path} ({len(drone['features'])} parcels)")

    print("Generating revenue CSV...")
    csv_path = generate_revenue_csv(cadastral["features"])
    print(f"  Written: {csv_path} ({len(cadastral['features'])} records)")

    print("\nSeed data generation complete!")
    print(f"  Cadastral: {len(cadastral['features'])} parcels")
    print(f"  Drone:     {len(drone['features'])} parcels")
    print(f"  Revenue:   {len(cadastral['features'])} records")


if __name__ == "__main__":
    main()
