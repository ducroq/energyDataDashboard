import json
from datetime import datetime, timedelta
from typing import Dict, Any
import math

def convert_value(value):
    none_strings = ['', '-', 'n/a', 'nan', 'null', 'none', 'inf', '-inf', 'infinity', '-infinity']
    
    # Handle None input
    if value is None:
        return None
    
    # Check for float infinity and NaN
    if isinstance(value, float):
        if math.isinf(value) or math.isnan(value):
            return None
        return value
    
    # If it's a string, convert to lowercase for comparison
    if isinstance(value, str):
        value_lower = value.strip().lower()
        if value_lower in none_strings:
            return None
    
    # If it's already an int, return as is
    if isinstance(value, int):
        return value
    
    # Try converting to int, then float
    try:
        return int(value)
    except (ValueError, TypeError):
        try:
            float_value = float(value)
            # Check again for infinity and NaN after conversion
            if math.isinf(float_value) or math.isnan(float_value):
                return None
            return float_value
        except (ValueError, TypeError):
            # If it's not a number, return the original value
            return value

class EnhancedDataSet:
    def __init__(self, metadata: Dict[str, Any], data: Dict[str, Any]):
        self.metadata = metadata
        data_type = metadata['data_type']
        if data_type == 'energy_price':
             self.data = self.validate_energy_prices(data)
        elif data_type == 'weather' or data_type == 'sun' or data_type == 'air':
            self.data = self.validate_weather_data(data)
        
    def validate_weather_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        validated_data = {}
        for timestamp, values in data.items():
            validated_values = {}
            for key, value in values.items():
                validated_values[key] = convert_value(value)
            validated_data[timestamp] = validated_values
        return validated_data

    def validate_energy_prices(self, data: Dict[str, Any]) -> Dict[str, Any]:
        validated_data = {timestamp: convert_value(value) for timestamp, value in data.items()}
        return validated_data    

    def __getitem__(self, key):
        if key in self.__dict__:
            return self.__dict__[key]
        raise KeyError(f"{key} not found in EnhancedDataSet")

    def __str__(self):
        return f"EnhancedDataSet(metadata={self.metadata}, data_points={len(self.data)})"

    def __repr__(self):
        return self.__str__()    

    def to_dict(self):
        return {
            'metadata': self.metadata,
            'data': self.data
        }
    
    def write_to_json(self, filename: str):
        def json_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Type {type(obj)} not serializable")

        with open(filename, 'w') as f:
            json.dump(self.to_dict(), f, indent=2, default=json_serializer)
        print(f"Data written to {filename}")   
    
class CombinedDataSet:
    def __init__(self):
        self.datasets = {}
        self.version = "2.0"

    def add_dataset(self, name: str, dataset: EnhancedDataSet):
        if name in self.datasets:
            raise ValueError(f"Dataset with name {name} already exists")
        if dataset is None:
            return
        self.datasets[name] = dataset.to_dict()

    def to_dict(self):
        return {
            'version': self.version,
            **self.datasets
        }
    
    def write_to_json(self, filename: str):
        def json_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Type {type(obj)} not serializable")

        with open(filename, 'w') as f:
            json.dump(self.to_dict(), f, indent=2, default=json_serializer)

if __name__ == "__main__":
    energy_prices = EnhancedDataSet(
        metadata={'data_type': 'energy_price',
                  'source': 'ENTSO-E Transparency Platform API v1.3',                  
                  'country': 'NL',
                  'units': 'EUR/MWh'},        
        data = {datetime.now().isoformat(): 50.5,
                (datetime.now() + timedelta(hours=1)).isoformat(): -5,
                (datetime.now() + timedelta(hours=2)).isoformat(): '-',
                (datetime.now() + timedelta(hours=3)).isoformat(): 'Infinity'}
    )

    print(energy_prices.to_dict())