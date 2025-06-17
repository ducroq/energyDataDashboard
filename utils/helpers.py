import os
import re
import json
import logging
from math import cos, asin, sqrt
from configparser import ConfigParser
from typing import Any, Dict

def ensure_output_directory(path: str) -> None:
    """Ensure the output directory exists."""
    try:
        os.makedirs(path, exist_ok=True)
        logging.info(f"Output directory ensured: {path}")
    except OSError as e:
        logging.error(f"Error creating folder: {e}")
        raise

def load_settings(script_dir: str, filename: str) -> ConfigParser:
    """Load configuration from the settings file."""
    config = ConfigParser()
    secrets_file = os.path.join(script_dir, filename)
    config.read(secrets_file)
    return config

def load_secrets(script_dir: str, filename: str = 'secrets.ini') -> ConfigParser:
    """
    Load configuration from environment variables or secrets file.
    
    Args:
        script_dir (str): Directory containing the secrets file
        filename (str): Name of the secrets file (default: 'secrets.ini')
        
    Returns:
        ConfigParser: Configuration with either environment variables or file contents
        
    Raises:
        RuntimeError: If neither environment variables nor secrets file are available
    """
    config = ConfigParser()
    
    # Initialize all required sections
    config.add_section('security_keys')
    config.add_section('api_keys')
    config.add_section('location')
    
    # Check for environment variables first
    env_vars = {
        # Security keys
        'ENCRYPTION_KEY': os.getenv('ENCRYPTION_KEY'),
        'HMAC_KEY': os.getenv('HMAC_KEY'),
        # API keys
        'ENTSOE_API_KEY': os.getenv('ENTSOE_API_KEY'),
        'OPENWEATHER_API_KEY': os.getenv('OPENWEATHER_API_KEY'),
        'METEO_API_KEY': os.getenv('METEO_API_KEY'),
        'GOOGLE_API_KEY': os.getenv('GOOGLE_API_KEY')
    }
    
    # If all required environment variables are present, use them
    if all(env_vars.values()):
        logging.info("Using configuration from environment variables")
        
        # Set security keys
        config.set('security_keys', 'encryption', env_vars['ENCRYPTION_KEY'])
        config.set('security_keys', 'hmac', env_vars['HMAC_KEY'])
        
        # Set API keys
        config.set('api_keys', 'entsoe', env_vars['ENTSOE_API_KEY'])
        config.set('api_keys', 'openweather', env_vars['OPENWEATHER_API_KEY'])
        config.set('api_keys', 'meteo', env_vars['METEO_API_KEY'])
        config.set('api_keys', 'google', env_vars['GOOGLE_API_KEY'])
        
        # Set location with defaults if not provided
        config.set('location', 'latitude', os.getenv('LATITUDE', '51.9851'))  # Default to Arnhem
        config.set('location', 'longitude', os.getenv('LONGITUDE', '5.8987'))
        
        return config
    
    # Fall back to secrets file if environment variables aren't available
    secrets_file = os.path.join(script_dir, filename)
    if os.path.exists(secrets_file):
        logging.info(f"Using configuration from {filename}")
        config.read(secrets_file)
        return config
    
    # If neither source is available, raise an error with clear message
    raise RuntimeError(
        "No configuration found. Either:\n"
        "1. Set environment variables (ENCRYPTION_KEY, HMAC_KEY, ENTSOE_API_KEY, "
        "OPENWEATHER_API_KEY, METEO_API_KEY, GOOGLE_API_KEY), or\n"
        f"2. Create a {filename} file in {script_dir}"
    )

def load_config(script_dir: str, filename: str = 'secrets.ini') -> ConfigParser:
    """
    Load configuration from environment variables or secrets file.
    
    Args:
        script_dir (str): Directory containing the secrets file
        filename (str): Name of the secrets file (default: 'secrets.ini')
        
    Returns:
        ConfigParser: Configuration with either environment variables or file contents
        
    Raises:
        RuntimeError: If neither environment variables nor secrets file are available
    """
    config = ConfigParser()
    
    # Check for environment variables first
    env_vars = {
        'ENTSOE_API_KEY': os.getenv('ENTSOE_API_KEY'),
        'OPENWEATHER_API_KEY': os.getenv('OPENWEATHER_API_KEY'),
        'METEO_API_KEY': os.getenv('METEO_API_KEY')
    }
    
    # If all required environment variables are present, use them
    if all(env_vars.values()):
        logging.info("Using configuration from environment variables")
        config['api_keys'] = {
            'entsoe': env_vars['ENTSOE_API_KEY'],
            'openweather': env_vars['OPENWEATHER_API_KEY'],
            'meteo': env_vars['METEO_API_KEY']
        }
        # Set default location if not provided in environment
        config['location'] = {
            'latitude': os.getenv('LATITUDE', '51.9851'),  # Default to Arnhem
            'longitude': os.getenv('LONGITUDE', '5.8987')
        }
        return config
    
    # Fall back to secrets file if environment variables aren't available
    secrets_file = os.path.join(script_dir, filename)
    if os.path.exists(secrets_file):
        logging.info(f"Using configuration from {filename}")
        config.read(secrets_file)
        return config
    
    # If neither source is available, raise an error with clear message
    raise RuntimeError(
        "No configuration found. Either:\n"
        "1. Set environment variables (ENTSOE_API_KEY, OPENWEATHER_API_KEY, METEO_API_KEY), or\n"
        f"2. Create a {filename} file in {script_dir}"
    )

def convert_value(value):
    if type(value) == int or type(value) == float:
        return value
    if value == '-':
        return None  # Using None instead of NaN for JSON compatibility
    elif value.lower() == 'none':
        return None
    try:
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value  # Keep as string if it's not a number
        
def distance(lat1, lon1, lat2, lon2):
    p = 0.017453292519943295
    a = (
        0.5
        - cos((lat2 - lat1) * p) / 2
        + cos(lat1 * p) * cos(lat2 * p) * (1 - cos((lon2 - lon1) * p)) / 2
    )
    distance = 12742 * asin(sqrt(a))
    return distance

def closest(data, v):
    return min(
        data,
        key=lambda p: distance(
            v["latitude"], v["longitude"], p["latitude"], p["longitude"]
        ),
    )

def detect_file_type(content: str) -> str:
    """
    Detect whether file content is JSON or encrypted Base64.
    
    Args:
        content (str): The file content to analyze
        
    Returns:
        str: 'json' or 'encrypted'
    """
    # Try to detect if it's base64 encoded
    base64_pattern = r'^[A-Za-z0-9+/=]+$'
    if re.match(base64_pattern, content.strip()):
        return 'encrypted'
    
    # Try to detect if it's JSON
    try:
        json.loads(content)
        return 'json'
    except json.JSONDecodeError:
        raise ValueError("File content is neither valid JSON nor base64 encoded")
    
def save_data_file(
    data: Dict[str, Any],
    file_path: str,
    handler: Any = None,
    encrypt: bool = False
) -> None:
    """
    Save data to a file, optionally encrypting it.
    
    Args:
        data (dict): The data to save
        file_path (str): Path where to save the file
        handler (SecureDataHandler, optional): Handler for encrypting data
        encrypt (bool): Whether to encrypt the data
    """
    try:
        if encrypt:
            if handler is None:
                raise ValueError("Encryption requested but no handler provided")
            encrypted_data = handler.encrypt_and_sign(data.to_dict())
            with open(file_path, 'w') as f:
                f.write(encrypted_data)
        else:
            data.write_to_json(file_path)
            # with open(file_path, 'w') as f:
            #     json.dump(data, f, indent=2)
    except Exception as e:
        logging.error(f"Error saving file {file_path}: {e}")
        raise
    
def load_data_file(file_path: str, handler: Any = None) -> Dict[str, Any]:
    """
    Load data from a file, automatically detecting if it's encrypted or plain JSON.
    
    Args:
        file_path (str): Path to the file to load
        handler (SecureDataHandler, optional): Handler for decrypting data
        
    Returns:
        dict: The loaded data
    """
    try:
        with open(file_path, 'r') as f:
            content = f.read().strip()
        
        file_type = detect_file_type(content)
        
        if file_type == 'encrypted':
            if handler is None:
                raise ValueError("Encrypted file found but no handler provided")
            return handler.decrypt_and_verify(content)
        else:
            return json.loads(content)
            
    except Exception as e:
        logging.error(f"Error loading file {file_path}: {e}")
        raise
