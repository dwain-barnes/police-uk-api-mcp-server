from mcp.server.fastmcp import FastMCP
import requests
import signal
import sys
import time

# Handle SIGINT (Ctrl+C) gracefully
def signal_handler(sig, frame):
    print("Shutting down server gracefully...")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# Create an MCP server
mcp = FastMCP(
    name="police-uk-api-tools",
    host="127.0.0.1",
    port=5000,
    timeout=30  # Timeout in seconds
)

# Helper function to make API requests to police.uk
def make_api_request(endpoint, params=None):
    base_url = "https://data.police.uk/api"
    url = f"{base_url}/{endpoint}"
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        return None

# Tool 1: Street-level crimes
@mcp.tool()
def get_street_level_crimes(lat: float = None, lng: float = None, poly: str = None, date: str = None, category: str = "all-crime") -> list:
    """Retrieve street-level crimes by lat/lng or custom polygon area.
    
    Args:
        lat (float, optional): Latitude of the requested crime area.
        lng (float, optional): Longitude of the requested crime area.
        poly (str, optional): The lat/lng pairs defining the boundary of the custom area.
        date (str, optional): Limit results to a specific month (YYYY-MM).
        category (str, optional): The crime category (default is 'all-crime').
    
    Returns:
        list: List of crime data.
    """
    params = {"date": date} if date else {}
    if lat and lng:
        params.update({"lat": lat, "lng": lng})
    elif poly:
        params["poly"] = poly
    else:
        return []
    endpoint = f"crimes-street/{category}"
    return make_api_request(endpoint, params) or []

# Tool 2: Street-level outcomes
@mcp.tool()
def get_street_level_outcomes(lat: float = None, lng: float = None, poly: str = None, location_id: int = None, date: str = None) -> list:
    """Retrieve outcomes by lat/lng, custom polygon, or location ID.
    
    Args:
        lat (float, optional): Latitude of the requested area.
        lng (float, optional): Longitude of the requested area.
        poly (str, optional): The lat/lng pairs defining the boundary of the custom area.
        location_id (int, optional): The ID of the location.
        date (str, optional): Limit results to a specific month (YYYY-MM).
    
    Returns:
        list: List of outcome data.
    """
    params = {"date": date} if date else {}
    if location_id:
        params["location_id"] = location_id
    elif lat and lng:
        params.update({"lat": lat, "lng": lng})
    elif poly:
        params["poly"] = poly
    else:
        return []
    return make_api_request("outcomes-at-location", params) or []

# Tool 3: Crimes at a location
@mcp.tool()
def get_crimes_at_location(lat: float = None, lng: float = None, location_id: int = None, date: str = None) -> list:
    """Retrieve crimes at a specific location by ID or nearest to lat/lng.
    
    Args:
        lat (float, optional): Latitude of the requested crime area.
        lng (float, optional): Longitude of the requested crime area.
        location_id (int, optional): The ID of the location.
        date (str, optional): Limit results to a specific month (YYYY-MM).
    
    Returns:
        list: List of crime data.
    """
    params = {"date": date} if date else {}
    if location_id:
        params["location_id"] = location_id
    elif lat and lng:
        params.update({"lat": lat, "lng": lng})
    else:
        return []
    return make_api_request("crimes-at-location", params) or []

# Tool 4: Crimes with no location
@mcp.tool()
def get_crimes_no_location(category: str, force: str, date: str = None) -> list:
    """Retrieve crimes that could not be mapped to a location.
    
    Args:
        category (str): The category of the crimes.
        force (str): Specific police force.
        date (str, optional): Limit results to a specific month (YYYY-MM).
    
    Returns:
        list: List of crime data.
    """
    params = {"category": category, "force": force}
    if date:
        params["date"] = date
    return make_api_request("crimes-no-location", params) or []

# Tool 5: Crime categories
@mcp.tool()
def get_crime_categories(date: str = None) -> list:
    """Retrieve valid crime categories for a given date.
    
    Args:
        date (str, optional): Specific month (YYYY-MM).
    
    Returns:
        list: List of crime categories.
    """
    params = {"date": date} if date else {}
    return make_api_request("crime-categories", params) or []

# Tool 6: Last updated
@mcp.tool()
def get_last_updated() -> str:
    """Retrieve the date when crime data was last updated.
    
    Returns:
        str: The date in ISO format.
    """
    data = make_api_request("crime-last-updated")
    return data.get("date", "") if data else ""

# Tool 7: Outcomes for a specific crime
@mcp.tool()
def get_outcomes_for_crime(persistent_id: str) -> dict:
    """Retrieve outcomes for a specific crime by persistent ID.
    
    Args:
        persistent_id (str): The 64-character unique identifier for the crime.
    
    Returns:
        dict: Crime and outcome data.
    """
    endpoint = f"outcomes-for-crime/{persistent_id}"
    return make_api_request(endpoint) or {}

# Tool 8: List of forces
@mcp.tool()
def get_list_of_forces() -> list:
    """Retrieve a list of all police forces.
    
    Returns:
        list: List of force IDs and names.
    """
    return make_api_request("forces") or []

# Tool 9: Specific force details
@mcp.tool()
def get_force_details(force_id: str) -> dict:
    """Retrieve details for a specific police force.
    
    Args:
        force_id (str): The unique identifier for the force.
    
    Returns:
        dict: Force details.
    """
    endpoint = f"forces/{force_id}"
    return make_api_request(endpoint) or {}

# Tool 10: Senior officers
@mcp.tool()
def get_senior_officers(force_id: str) -> list:
    """Retrieve senior officers for a specific police force.
    
    Args:
        force_id (str): The unique identifier for the force.
    
    Returns:
        list: List of senior officers.
    """
    endpoint = f"forces/{force_id}/people"
    return make_api_request(endpoint) or []

# Tool 11: List of neighbourhoods for a force
@mcp.tool()
def get_neighbourhoods(force_id: str) -> list:
    """Retrieve a list of neighbourhoods for a specific police force.
    
    Args:
        force_id (str): The unique identifier for the force.
    
    Returns:
        list: List of neighbourhood IDs and names.
    """
    endpoint = f"{force_id}/neighbourhoods"
    return make_api_request(endpoint) or []

# Tool 12: Specific neighbourhood
@mcp.tool()
def get_neighbourhood_details(force_id: str, neighbourhood_id: str) -> dict:
    """Retrieve details for a specific neighbourhood within a force.
    
    Args:
        force_id (str): The unique identifier for the force.
        neighbourhood_id (str): The unique identifier for the neighbourhood.
    
    Returns:
        dict: Neighbourhood details.
    """
    endpoint = f"{force_id}/{neighbourhood_id}"
    return make_api_request(endpoint) or {}

# Tool 13: Neighbourhood boundary
@mcp.tool()
def get_neighbourhood_boundary(force_id: str, neighbourhood_id: str) -> list:
    """Retrieve the boundary coordinates for a specific neighbourhood.
    
    Args:
        force_id (str): The unique identifier for the force.
        neighbourhood_id (str): The unique identifier for the neighbourhood.
    
    Returns:
        list: List of lat/lng pairs.
    """
    endpoint = f"{force_id}/{neighbourhood_id}/boundary"
    return make_api_request(endpoint) or []

# Tool 14: Neighbourhood team
@mcp.tool()
def get_neighbourhood_team(force_id: str, neighbourhood_id: str) -> list:
    """Retrieve the team members for a specific neighbourhood.
    
    Args:
        force_id (str): The unique identifier for the force.
        neighbourhood_id (str): The unique identifier for the neighbourhood.
    
    Returns:
        list: List of team members.
    """
    endpoint = f"{force_id}/{neighbourhood_id}/people"
    return make_api_request(endpoint) or []

# Tool 15: Neighbourhood events
@mcp.tool()
def get_neighbourhood_events(force_id: str, neighbourhood_id: str) -> list:
    """Retrieve events scheduled for a specific neighbourhood.
    
    Args:
        force_id (str): The unique identifier for the force.
        neighbourhood_id (str): The unique identifier for the neighbourhood.
    
    Returns:
        list: List of events.
    """
    endpoint = f"{force_id}/{neighbourhood_id}/events"
    return make_api_request(endpoint) or []

# Tool 16: Neighbourhood priorities
@mcp.tool()
def get_neighbourhood_priorities(force_id: str, neighbourhood_id: str) -> list:
    """Retrieve policing priorities for a specific neighbourhood.
    
    Args:
        force_id (str): The unique identifier for the force.
        neighbourhood_id (str): The unique identifier for the neighbourhood.
    
    Returns:
        list: List of priorities.
    """
    endpoint = f"{force_id}/{neighbourhood_id}/priorities"
    return make_api_request(endpoint) or []

# Tool 17: Locate a neighbourhood
@mcp.tool()
def locate_neighbourhood(lat: float, lng: float) -> dict:
    """Find the neighbourhood policing team for a given latitude and longitude.
    
    Args:
        lat (float): Latitude of the location.
        lng (float): Longitude of the location.
    
    Returns:
        dict: Force and neighbourhood identifiers.
    """
    params = {"q": f"{lat},{lng}"}
    return make_api_request("locate-neighbourhood", params) or {}

# Tool 18: Stop and searches by area
@mcp.tool()
def get_stop_searches_by_area(lat: float = None, lng: float = None, poly: str = None, date: str = None) -> list:
    """Retrieve stop and searches within a 1-mile radius or custom area.
    
    Args:
        lat (float, optional): Latitude of the centre point.
        lng (float, optional): Longitude of the centre point.
        poly (str, optional): Lat/lng pairs defining a polygon.
        date (str, optional): Specific month (YYYY-MM).
    
    Returns:
        list: List of stop and search incidents.
    """
    params = {"date": date} if date else {}
    if lat is not None and lng is not None:
        params.update({"lat": lat, "lng": lng})
    elif poly:
        params["poly"] = poly
    else:
        return []
    return make_api_request("stops-street", params) or []

# Tool 19: Stop and searches by location
@mcp.tool()
def get_stop_searches_by_location(location_id: int, date: str = None) -> list:
    """Retrieve stop and searches at a specific location by ID.
    
    Args:
        location_id (int): The ID of the location.
        date (str, optional): Specific month (YYYY-MM).
    
    Returns:
        list: List of stop and search incidents.
    """
    params = {"location_id": location_id}
    if date:
        params["date"] = date
    return make_api_request("stops-at-location", params) or []

# Tool 20: Stop and searches with no location
@mcp.tool()
def get_stop_searches_no_location(force_id: str, date: str = None) -> list:
    """Retrieve stop and searches that could not be mapped to a location.
    
    Args:
        force_id (str): The unique identifier for the force.
        date (str, optional): Specific month (YYYY-MM).
    
    Returns:
        list: List of stop and search incidents.
    """
    params = {"force": force_id}
    if date:
        params["date"] = date
    return make_api_request("stops-no-location", params) or []

# Tool 21: Stop and searches by force
@mcp.tool()
def get_stop_searches_by_force(force_id: str, date: str = None) -> list:
    """Retrieve stop and searches reported by a specific force.
    
    Args:
        force_id (str): The unique identifier for the force.
        date (str, optional): Specific month (YYYY-MM).
    
    Returns:
        list: List of stop and search incidents.
    """
    params = {"force": force_id}
    if date:
        params["date"] = date
    return make_api_request("stops-force", params) or []

# Start the server
if __name__ == "__main__":
    try:
        print("Starting MCP server 'police-uk-api-tools' on 127.0.0.1:5000")
        mcp.run()
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(5)