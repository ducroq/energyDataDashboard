#!/usr/bin/env python3
"""
Energy data decryption script for Netlify build process.
Uses SecureDataHandler class with AES-CBC encryption and HMAC-SHA256.
"""

import os
import json
import base64
import urllib.request
from datetime import datetime
from utils.secure_data_handler import SecureDataHandler

def json_serializer(obj):
    """Handle datetime serialization."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def fetch_and_decrypt_energy_data():
    """Fetch and decrypt energy price forecast data."""
    try:
        # Get base64-encoded keys from environment variables
        encryption_key_b64 = os.environ.get('ENCRYPTION_KEY_B64')
        hmac_key_b64 = os.environ.get('HMAC_KEY_B64')
        
        if not encryption_key_b64 or not hmac_key_b64:
            print("ERROR: ENCRYPTION_KEY_B64 and HMAC_KEY_B64 environment variables must be set")
            return False
        
        # Decode the base64 keys (same as your code)
        encryption_key = base64.b64decode(encryption_key_b64)
        hmac_key = base64.b64decode(hmac_key_b64)
        
        print(f"Decoded encryption key length: {len(encryption_key)} bytes")
        print(f"Decoded HMAC key length: {len(hmac_key)} bytes")
        
        # Initialize your SecureDataHandler with the decoded keys
        handler = SecureDataHandler(encryption_key, hmac_key)
        
        # Fetch encrypted data from your GitHub Pages endpoint
        url = 'https://ducroq.github.io/energydatahub/energy_price_forecast.json'
        print(f"Fetching energy data from {url}")
        
        with urllib.request.urlopen(url) as response:
            encrypted_data = response.read().decode()
        
        print(f"Fetched encrypted data length: {len(encrypted_data)} characters")
        
        # Decrypt using your handler (same method as your example)
        print("Decrypting data...")
        decrypted = handler.decrypt_and_verify(encrypted_data)
        
        # Ensure data directory exists
        os.makedirs('static/data', exist_ok=True)
        output_path = 'static/data/energy_price_forecast.json'
        
        # Save decrypted data with datetime serialization
        with open(output_path, 'w') as f:
            json.dump(decrypted, f, indent=2, default=json_serializer)
        
        print(f"Successfully decrypted and saved energy data to {output_path}")
        
        # Log some info about the data
        if isinstance(decrypted, list):
            print(f"Data contains {len(decrypted)} records")
            if len(decrypted) > 0:
                print(f"First record: {decrypted[0]}")
        elif isinstance(decrypted, dict):
            print(f"Data is a dict with keys: {list(decrypted.keys())}")
        else:
            print(f"Data type: {type(decrypted)}")
        
        return True
        
    except Exception as e:
        print(f"Error decrypting energy data: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function."""
    print("Starting energy data decryption...")
    success = fetch_and_decrypt_energy_data()
    
    if success:
        print("Energy data decryption completed successfully!")
    else:
        print("Energy data decryption failed!")
    
    return success

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)