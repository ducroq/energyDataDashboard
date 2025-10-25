#!/usr/bin/env python3
"""
Energy data decryption script with intelligent caching for Netlify builds.
Uses SecureDataHandler class with AES-CBC encryption and HMAC-SHA256.

Optimizations:
- Skips decryption if data is fresh (< 24 hours old)
- Validates remote data timestamp before fetching
- Caches decrypted data between builds
"""

import os
import sys
import json
import base64
import urllib.request
import time
import logging
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from utils.secure_data_handler import SecureDataHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration
DATA_SOURCE_URL = 'https://ducroq.github.io/energydatahub/energy_price_forecast.json'
OUTPUT_DIR = 'static/data'
OUTPUT_FILE = 'energy_price_forecast.json'
CACHE_MAX_AGE_HOURS = 24  # Re-fetch if data is older than this
METADATA_FILE = 'energy_data_metadata.json'


def json_serializer(obj):
    """Handle datetime serialization."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def get_file_age_hours(filepath):
    """
    Get the age of a file in hours.

    Args:
        filepath (str): Path to the file

    Returns:
        float: Age in hours, or None if file doesn't exist
    """
    if not os.path.exists(filepath):
        return None

    file_mtime = os.path.getmtime(filepath)
    current_time = time.time()
    age_seconds = current_time - file_mtime
    age_hours = age_seconds / 3600

    return age_hours


def calculate_data_hash(data_str):
    """
    Calculate SHA256 hash of data string.

    Args:
        data_str (str): Data to hash

    Returns:
        str: Hex digest of SHA256 hash
    """
    return hashlib.sha256(data_str.encode()).hexdigest()


def load_metadata(metadata_path):
    """
    Load cached metadata about previous decryption.

    Args:
        metadata_path (str): Path to metadata file

    Returns:
        dict: Metadata or empty dict if not found
    """
    if not os.path.exists(metadata_path):
        return {}

    try:
        with open(metadata_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load metadata: {e}")
        return {}


def save_metadata(metadata_path, metadata):
    """
    Save metadata about current decryption.

    Args:
        metadata_path (str): Path to metadata file
        metadata (dict): Metadata to save
    """
    try:
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=json_serializer)
        logger.info(f"Saved metadata to {metadata_path}")
    except Exception as e:
        logger.warning(f"Failed to save metadata: {e}")


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
            logger.info(f"Attempt {attempt + 1}/{max_retries}: Fetching {url}")
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read().decode()
                logger.info(f"Successfully fetched {len(data)} characters from {url}")
                return data
        except urllib.error.HTTPError as e:
            last_error = e
            logger.error(f"HTTP {e.code} error: {e.reason}")
            if e.code in [404, 403, 401]:  # Don't retry on client errors
                raise
        except urllib.error.URLError as e:
            last_error = e
            logger.error(f"Network error: {e.reason}")
        except Exception as e:
            last_error = e
            logger.error(f"Unexpected error: {e}")

        # If not the last attempt, wait before retrying
        if attempt < max_retries - 1:
            logger.info(f"Waiting {delay}s before retry...")
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


def should_skip_decryption(output_path, metadata_path):
    """
    Determine if decryption can be skipped based on cached data age.

    Args:
        output_path (str): Path to output data file
        metadata_path (str): Path to metadata file

    Returns:
        bool: True if decryption should be skipped, False otherwise
    """
    # Check if output file exists
    if not os.path.exists(output_path):
        logger.info("Output file does not exist, decryption required")
        return False

    # Check file age
    age_hours = get_file_age_hours(output_path)
    if age_hours is None:
        logger.info("Cannot determine file age, decryption required")
        return False

    if age_hours > CACHE_MAX_AGE_HOURS:
        logger.info(f"Cached data is {age_hours:.1f} hours old (max: {CACHE_MAX_AGE_HOURS}h), refresh needed")
        return False

    logger.info(f"Cached data is {age_hours:.1f} hours old (max: {CACHE_MAX_AGE_HOURS}h)")

    # Load metadata to check when data was last updated
    metadata = load_metadata(metadata_path)
    if metadata:
        last_fetch = metadata.get('last_fetch_time')
        if last_fetch:
            logger.info(f"Last fetch: {last_fetch}")

    logger.info("✓ Using cached data (still fresh)")
    return True


def fetch_and_decrypt_energy_data(force_refresh=False):
    """
    Fetch and decrypt energy price forecast data with intelligent caching.

    Args:
        force_refresh (bool): Force refresh even if cache is valid

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Ensure output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)

        output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
        metadata_path = os.path.join(OUTPUT_DIR, METADATA_FILE)

        # Check if we can skip decryption
        if not force_refresh and should_skip_decryption(output_path, metadata_path):
            logger.info("Skipping decryption - using cached data")
            return True

        # Get base64-encoded keys from environment variables
        encryption_key_b64 = os.environ.get('ENCRYPTION_KEY_B64')
        hmac_key_b64 = os.environ.get('HMAC_KEY_B64')

        logger.info("Validating environment variables...")

        # Validate and decode the keys
        try:
            encryption_key = validate_base64_key(encryption_key_b64, 'ENCRYPTION_KEY_B64', expected_length=32)
            hmac_key = validate_base64_key(hmac_key_b64, 'HMAC_KEY_B64', expected_length=32)
            logger.info(f"Encryption key validated: {len(encryption_key)} bytes (256-bit)")
            logger.info(f"HMAC key validated: {len(hmac_key)} bytes (256-bit)")
        except ValueError as e:
            logger.error(f"Environment variable validation failed: {e}")
            return False

        # Initialize SecureDataHandler
        handler = SecureDataHandler(encryption_key, hmac_key)

        # Fetch encrypted data with retry logic
        logger.info(f"Fetching energy data from {DATA_SOURCE_URL}")
        encrypted_data = fetch_with_retry(DATA_SOURCE_URL, max_retries=3, initial_delay=2)

        # Calculate hash of encrypted data
        data_hash = calculate_data_hash(encrypted_data)

        # Check if data has changed
        metadata = load_metadata(metadata_path)
        previous_hash = metadata.get('data_hash')

        if previous_hash == data_hash and os.path.exists(output_path):
            logger.info("Remote data unchanged (hash match), using existing decrypted data")
            # Update metadata timestamp
            metadata['last_check_time'] = datetime.now()
            save_metadata(metadata_path, metadata)
            return True

        if previous_hash:
            logger.info(f"Data has changed (hash: {data_hash[:16]}...)")
        else:
            logger.info(f"First fetch (hash: {data_hash[:16]}...)")

        # Decrypt the data
        logger.info("Decrypting data...")
        decrypted = handler.decrypt_and_verify(encrypted_data)

        # Save decrypted data
        with open(output_path, 'w') as f:
            json.dump(decrypted, f, indent=2, default=json_serializer)

        logger.info(f"Successfully decrypted and saved energy data to {output_path}")

        # Log data info
        if isinstance(decrypted, list):
            logger.info(f"Data contains {len(decrypted)} records")
        elif isinstance(decrypted, dict):
            logger.info(f"Data is a dict with keys: {list(decrypted.keys())}")
            # Log data point counts
            for key, value in decrypted.items():
                if isinstance(value, dict) and 'data' in value:
                    data_points = len(value.get('data', {}))
                    logger.info(f"  {key}: {data_points} data points")

        # Save metadata
        new_metadata = {
            'last_fetch_time': datetime.now(),
            'last_check_time': datetime.now(),
            'data_hash': data_hash,
            'file_size_bytes': len(encrypted_data),
            'source_url': DATA_SOURCE_URL,
            'cache_max_age_hours': CACHE_MAX_AGE_HOURS
        }
        save_metadata(metadata_path, new_metadata)

        return True

    except Exception as e:
        logger.error(f"Error in fetch_and_decrypt_energy_data: {e}", exc_info=True)

        # If we have cached data, use it as fallback
        output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
        if os.path.exists(output_path):
            age_hours = get_file_age_hours(output_path)
            logger.warning(f"Using cached data as fallback (age: {age_hours:.1f}h)")
            return True

        return False


def main():
    """Main function."""
    logger.info("=" * 70)
    logger.info("Energy Data Decryption (with intelligent caching)")
    logger.info("=" * 70)

    # Check for force refresh flag
    force_refresh = '--force' in sys.argv or '-f' in sys.argv
    if force_refresh:
        logger.info("Force refresh requested")

    success = fetch_and_decrypt_energy_data(force_refresh=force_refresh)

    if success:
        logger.info("✓ Energy data ready!")
        logger.info("=" * 70)
    else:
        logger.error("✗ Energy data decryption failed!")
        logger.info("=" * 70)

    return success


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
