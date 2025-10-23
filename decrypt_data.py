#!/usr/bin/env python3
"""
Energy data decryption script for Netlify build process.
Uses SecureDataHandler class with AES-CBC encryption and HMAC-SHA256.
"""

import os
import json
import base64
import urllib.request
import time
from datetime import datetime
from utils.secure_data_handler import SecureDataHandler

def json_serializer(obj):
    """Handle datetime serialization."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def fetch_with_retry(url, max_retries=3, initial_delay=1):
    """
    Fetch URL with exponential backoff retry logic.

    Args:
        url (str): URL to fetch
        max_retries (int): Maximum number of retry attempts
        initial_delay (int): Initial delay in seconds (doubles with each retry)

    Returns:
        str: Response data

    Raises:
        Exception: If all retry attempts fail
    """
    delay = initial_delay
    last_error = None

    for attempt in range(max_retries):
        try:
            print(f"Attempt {attempt + 1}/{max_retries}: Fetching {url}")
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read().decode()
                print(f"SUCCESS: Fetched data ({len(data)} characters)")
                return data
        except urllib.error.HTTPError as e:
            last_error = e
            print(f"ERROR: HTTP {e.code}: {e.reason}")
            if e.code in [404, 403, 401]:  # Don't retry on client errors
                raise
        except urllib.error.URLError as e:
            last_error = e
            print(f"ERROR: Network error: {e.reason}")
        except Exception as e:
            last_error = e
            print(f"ERROR: {e}")

        # If not the last attempt, wait before retrying
        if attempt < max_retries - 1:
            print(f"Waiting {delay}s before retry...")
            time.sleep(delay)
            delay *= 2  # Exponential backoff

    # All retries failed
    raise Exception(f"Failed to fetch {url} after {max_retries} attempts. Last error: {last_error}")

def validate_base64_key(key_b64, key_name, expected_length=32):
    """
    Validate that a base64-encoded key is properly formatted and has correct length.

    Args:
        key_b64 (str): Base64-encoded key
        key_name (str): Name of the key (for error messages)
        expected_length (int): Expected length in bytes after decoding (default: 32 for 256-bit)

    Returns:
        bytes: Decoded key

    Raises:
        ValueError: If validation fails
    """
    if not key_b64:
        raise ValueError(f"{key_name} is not set")

    # Check if it looks like base64
    if not key_b64.replace('=', '').replace('+', '').replace('/', '').isalnum():
        raise ValueError(f"{key_name} does not appear to be valid base64 (contains invalid characters)")

    try:
        decoded_key = base64.b64decode(key_b64)
    except Exception as e:
        raise ValueError(f"{key_name} is not valid base64: {e}")

    if len(decoded_key) != expected_length:
        raise ValueError(
            f"{key_name} has incorrect length: {len(decoded_key)} bytes "
            f"(expected {expected_length} bytes for {expected_length * 8}-bit key)"
        )

    return decoded_key

def fetch_and_decrypt_energy_data():
    """Fetch and decrypt energy price forecast data."""
    try:
        # Get base64-encoded keys from environment variables
        encryption_key_b64 = os.environ.get('ENCRYPTION_KEY_B64')
        hmac_key_b64 = os.environ.get('HMAC_KEY_B64')

        print("Validating environment variables...")

        # Validate and decode the keys
        try:
            encryption_key = validate_base64_key(encryption_key_b64, 'ENCRYPTION_KEY_B64', expected_length=32)
            hmac_key = validate_base64_key(hmac_key_b64, 'HMAC_KEY_B64', expected_length=32)
            print(f"SUCCESS: Encryption key validated: {len(encryption_key)} bytes (256-bit)")
            print(f"SUCCESS: HMAC key validated: {len(hmac_key)} bytes (256-bit)")
        except ValueError as e:
            print(f"ERROR: Environment variable validation failed: {e}")
            return False
        
        # Initialize your SecureDataHandler with the decoded keys
        handler = SecureDataHandler(encryption_key, hmac_key)
        
        # Fetch encrypted data from GitHub Pages endpoint with retry logic
        url = 'https://ducroq.github.io/energydatahub/energy_price_forecast.json'
        print(f"Fetching energy data from {url}")

        encrypted_data = fetch_with_retry(url, max_retries=3, initial_delay=2)
        
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