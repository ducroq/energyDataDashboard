#!/usr/bin/env python3
"""
Refresh dashboard data by loading keys from energyDataHub secrets.ini
and fetching/decrypting the latest data.
"""

import os
import sys
import configparser
from pathlib import Path

# Path to energyDataHub secrets.ini
SECRETS_PATH = r"C:\Users\scbry\HAN\HAN H2 LAB IPKW - Projects - WebBasedControl\01. Software\energyDataHub\secrets.ini"

def main():
    print("=" * 60)
    print("Energy Dashboard Data Refresh")
    print("=" * 60)
    print()

    # Check if secrets.ini exists
    if not Path(SECRETS_PATH).exists():
        print(f"ERROR: secrets.ini not found at {SECRETS_PATH}")
        print("Please check the path to your energyDataHub installation")
        return False

    print(f"Loading encryption keys from energyDataHub...")
    print(f"Path: {SECRETS_PATH}")
    print()

    # Read secrets.ini
    try:
        config = configparser.ConfigParser()
        config.read(SECRETS_PATH)

        encryption_key = config.get('security_keys', 'encryption')
        hmac_key = config.get('security_keys', 'hmac')

        if not encryption_key or not hmac_key:
            print("ERROR: Could not read encryption keys from secrets.ini")
            return False

        print("[OK] Keys loaded successfully")
        print()

    except Exception as e:
        print(f"ERROR: Failed to read secrets.ini: {e}")
        return False

    # Set environment variables for the decrypt script
    os.environ['ENCRYPTION_KEY_B64'] = encryption_key
    os.environ['HMAC_KEY_B64'] = hmac_key

    print("Fetching and decrypting latest energy data...")
    print()

    # Import and run the decrypt function
    sys.path.insert(0, os.path.dirname(__file__))
    from decrypt_data_cached import fetch_and_decrypt_energy_data

    try:
        success = fetch_and_decrypt_energy_data(force_refresh=True)

        if success:
            print()
            print("=" * 60)
            print("SUCCESS: Dashboard data refreshed!")
            print("=" * 60)
            print()
            print("The dashboard now has the latest data from energyDataHub")
            print("with the new 48-hour collection window (full today + tomorrow)")
            print()
            print("You can now run: npm run dev")
            print("to start the dashboard and see the updated forecasts")
            return True
        else:
            print()
            print("ERROR: Failed to decrypt data")
            return False

    except Exception as e:
        print()
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
