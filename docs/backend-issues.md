# Backend Issues & Fixes Needed

**Project:** Energy Data Hub (data collection repository)
**Impact:** Critical - affects data quality for downstream consumers
**Status:** Workaround implemented in dashboard, backend fix still needed

---

## Critical Bug: Malformed Timezone Offsets

### Problem Description

The Energy Data Hub outputs malformed timezone offsets in the encrypted JSON:
- **Elspot data:** Uses `+00:09` instead of proper `+02:00` (CEST) or `+01:00` (CET)
- **Historical issue:** Code previously handled `+00:18` (may still exist in some sources)

### Example of Malformed Data

```json
{
  "elspot": {
    "data": {
      "2025-10-23T22:00:00+00:09": 14.15,  // ❌ WRONG - should be +02:00
      "2025-10-23T23:00:00+00:09": 6.90     // ❌ WRONG - should be +02:00
    }
  },
  "epex": {
    "data": {
      "2025-10-23T22:00:00+02:00": 95.91,   // ✅ CORRECT
      "2025-10-23T23:00:00+02:00": 90.06    // ✅ CORRECT
    }
  }
}
```

### Impact

1. **Data visualization errors:** Elspot trends appeared misaligned with EPEX/ENTSO-E
2. **Time synchronization issues:** Events appear to happen at different times across sources
3. **API consumer confusion:** Clients must implement workarounds to interpret data correctly
4. **Standards non-compliance:** Invalid ISO 8601 timezone format

### Dashboard Workaround

The dashboard currently implements a client-side fix in `chart.js`:

```javascript
// Normalize malformed timezone offsets
function normalizeTimestamp(timestamp) {
  // Fix +00:09 and +00:18 to proper +02:00 (CEST)
  return timestamp
    .replace(/\+00:09$/, '+02:00')
    .replace(/\+00:18$/, '+02:00');
}
```

**This workaround should remain for backward compatibility even after backend fix.**

---

## Root Cause (Hypothesis)

The bug likely originates in one of these areas:

### 1. Nord Pool API Response Parsing
- API might return timestamps in local time without proper timezone
- Conversion logic incorrectly calculates offset
- String formatting error when constructing ISO timestamps

### 2. Timezone Handling in Python

Suspected buggy code pattern:
```python
# Getting timezone offset but formatting it incorrectly
offset = some_timezone.utcoffset(datetime.now())
# Results in timedelta that gets formatted as +00:09 or +00:18
# instead of +02:00
```

### 3. API Quirks
- Some energy market APIs return non-standard timezone formats
- Direct passthrough without validation

---

## Recommended Backend Fixes

### Fix 1: Standardize Timezone Handling

Create a utility function to ensure all timestamps use correct Amsterdam timezone:

```python
from datetime import datetime
from zoneinfo import ZoneInfo  # Python 3.9+

def normalize_amsterdam_timestamp(dt: datetime) -> str:
    """
    Normalize a datetime to Amsterdam timezone with proper ISO format.

    Args:
        dt: datetime object (naive or aware)

    Returns:
        ISO 8601 string with correct timezone (+02:00 or +01:00)
    """
    amsterdam_tz = ZoneInfo('Europe/Amsterdam')

    # If naive, assume it's already in Amsterdam time
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=amsterdam_tz)
    else:
        # Convert to Amsterdam timezone
        dt = dt.astimezone(amsterdam_tz)

    # Format with proper timezone offset
    # This ensures +02:00 (CEST) or +01:00 (CET)
    return dt.isoformat()


def validate_timestamp(timestamp_str: str) -> bool:
    """
    Validate that a timestamp has proper timezone format.

    Returns:
        True if valid, False if malformed (e.g., +00:09, +00:18)
    """
    import re

    # Check for malformed offsets
    if re.search(r'\+00:(09|18)', timestamp_str):
        return False

    # Check for valid Amsterdam offsets
    if re.search(r'\+0[12]:00', timestamp_str):
        return True

    return False
```

### Fix 2: Add Validation Step

Before writing data to JSON, validate all timestamps:

```python
def validate_data_before_output(data: dict) -> dict:
    """
    Validate and fix timestamps in the data structure.
    Raises warnings for malformed timestamps.
    """
    import logging

    logger = logging.getLogger(__name__)

    for source_name, source_data in data.items():
        if source_name == 'version':
            continue

        if 'data' not in source_data:
            continue

        # Check all timestamps
        fixed_data = {}
        for timestamp, price in source_data['data'].items():
            if not validate_timestamp(timestamp):
                logger.warning(
                    f"Malformed timestamp in {source_name}: {timestamp}"
                )
                # Attempt to fix by parsing and re-formatting
                dt = datetime.fromisoformat(timestamp)
                timestamp = normalize_amsterdam_timestamp(dt)

            fixed_data[timestamp] = price

        source_data['data'] = fixed_data

    return data
```

### Fix 3: Source-Specific Handling for Elspot

```python
def process_elspot_response(api_response: dict) -> dict:
    """
    Process Nord Pool/Elspot API response.
    Handle timezone quirks from the API.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    processed_data = {}
    amsterdam_tz = ZoneInfo('Europe/Amsterdam')

    for entry in api_response.get('data', []):
        # Parse the timestamp from API
        raw_timestamp = entry['timestamp']

        # If API returns naive timestamp, it's likely Amsterdam local time
        dt = datetime.fromisoformat(raw_timestamp.replace('Z', ''))
        dt = dt.replace(tzinfo=amsterdam_tz)

        # Ensure proper ISO format
        normalized_timestamp = dt.isoformat()

        processed_data[normalized_timestamp] = entry['price']

    return {
        'data': processed_data,
        'metadata': {
            'source': 'Nordpool API',
            'units': 'EUR/MWh',
            'timezone': 'Europe/Amsterdam',
            'last_updated': datetime.now(amsterdam_tz).isoformat()
        }
    }
```

---

## Testing Strategy

### Unit Tests

```python
import pytest
from datetime import datetime
from zoneinfo import ZoneInfo

def test_normalize_amsterdam_timestamp_summer():
    """Test CEST (summer) timezone (+02:00)."""
    dt = datetime(2025, 7, 15, 12, 0)  # July = summer
    result = normalize_amsterdam_timestamp(dt)
    assert result == '2025-07-15T12:00:00+02:00'

def test_normalize_amsterdam_timestamp_winter():
    """Test CET (winter) timezone (+01:00)."""
    dt = datetime(2025, 1, 15, 12, 0)  # January = winter
    result = normalize_amsterdam_timestamp(dt)
    assert result == '2025-01-15T12:00:00+01:00'

def test_validate_timestamp_malformed():
    """Test detection of malformed timestamps."""
    assert validate_timestamp('2025-10-24T12:00:00+00:09') == False
    assert validate_timestamp('2025-10-24T12:00:00+00:18') == False

def test_validate_timestamp_correct():
    """Test validation of correct timestamps."""
    assert validate_timestamp('2025-10-24T12:00:00+02:00') == True
    assert validate_timestamp('2025-01-15T12:00:00+01:00') == True
```

### Integration Tests

```python
def test_elspot_data_quality():
    """
    Integration test: verify Elspot data has correct timezone.
    Run after data collection process.
    """
    import json

    # Load the generated data
    with open('energy_price_forecast.json') as f:
        data = json.load(f)

    # Check all Elspot timestamps
    for timestamp in data['elspot']['data'].keys():
        assert validate_timestamp(timestamp), \
            f"Malformed timestamp found: {timestamp}"

        # Should use +02:00 (CEST) or +01:00 (CET), never +00:09
        assert '+00:09' not in timestamp
        assert '+00:18' not in timestamp
```

### Manual Verification

After deploying fixes:

```bash
# Check for malformed timezones in output
curl -s https://ducroq.github.io/energydatahub/energy_price_forecast.json \
  | python -m json.tool \
  | grep -E '\+00:(09|18)'

# Should return no results if fixed
```

---

## Where to Investigate

### Files to Check in Energy Data Hub

Based on typical data collection architecture:

1. **API Client for Elspot/Nord Pool**
   - File likely named: `fetch_elspot.py`, `nordpool_client.py`, or similar
   - Look for timestamp parsing/formatting
   - Search for: `isoformat()`, `strftime()`, timezone conversions

2. **Data Processing Pipeline**
   - File likely named: `process_data.py`, `transform.py`, or similar
   - Look for normalization/standardization logic
   - Check timezone conversion functions

3. **Output/Serialization**
   - File that writes the final JSON
   - Encryption/formatting before upload
   - Search for: `json.dump()`, timestamp formatting

### Search Commands

```bash
# In Energy Data Hub repository:

# Find files handling Elspot data
grep -r "elspot\|nordpool" --include="*.py"

# Find timezone-related code
grep -r "timezone\|tzinfo\|utcoffset" --include="*.py"

# Find ISO format timestamp generation
grep -r "isoformat\|strftime.*%z" --include="*.py"

# Find the output JSON generation
grep -r "energy_price_forecast" --include="*.py"
```

---

## Migration Plan

### Phase 1: Immediate Fix (Week 1)
- [ ] Locate Elspot data collection code in Energy Data Hub
- [ ] Implement timezone normalization fix
- [ ] Add validation before encryption
- [ ] Deploy and monitor for 48 hours

### Phase 2: Testing & Validation (Week 1-2)
- [ ] Write unit tests for timezone handling
- [ ] Add integration tests
- [ ] Verify no `+00:09` or `+00:18` in new data
- [ ] Compare trends across sources (should align)

### Phase 3: Dashboard Cleanup (Week 2)
- [ ] Keep workaround for backward compatibility
- [ ] Add tests to verify dashboard handles both old and new formats
- [ ] Update documentation

---

## Success Metrics

After implementing fixes, verify:

1. **Zero malformed timestamps:**
   ```bash
   grep -c '+00:09\|+00:18' energy_price_forecast.json
   # Should output: 0
   ```

2. **Trend alignment:**
   - Minimum prices occur within same hour across sources
   - Maximum prices occur within same hour across sources
   - Correlation coefficient > 0.8 between sources

3. **Standards compliance:**
   - All timestamps validate as ISO 8601
   - Timezone offsets are `+02:00` or `+01:00` only

4. **No client-side workaround triggers:**
   - Monitor dashboard console logs
   - Should see zero timezone normalization events

---

## References

- [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) - International date/time standard
- [Python zoneinfo](https://docs.python.org/3/library/zoneinfo.html) - Timezone handling documentation
- [IANA Time Zone Database](https://www.iana.org/time-zones) - Official timezone data

---

**Document Status:** Active issue tracker
**Priority:** HIGH - affects data quality for all consumers
**Estimated Effort:** 2-3 days for immediate fix
**Risk:** LOW - fixes are isolated to timestamp formatting

**Last Updated:** 2025-10-25
**Related Commits:** eecec7a, 8dfd026
