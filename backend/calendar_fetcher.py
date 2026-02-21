import datetime
import os.path
import json

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'
OUTPUT_FILE = 'data/calendar_events.json'

def get_calendar_service():
    """Shows basic usage of the Google Calendar API.
    Prints the start and name of the next 10 events on the user's calendar.
    """
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                print(f"ERROR: {CREDENTIALS_FILE} not found.")
                print("1. Go to Google Cloud Console (https://console.cloud.google.com/)")
                print("2. Create a Project, enable 'Google Calendar API'")
                print("3. Setup OAuth Consent Screen")
                print("4. Go to Credentials -> Create Credentials -> OAuth client ID (Desktop App)")
                print(f"5. Download JSON and save as {CREDENTIALS_FILE} in the backend directory.")
                exit(1)
            
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=8080)
        
        # Save the credentials for the next run
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    try:
        service = build('calendar', 'v3', credentials=creds)
        return service
    except HttpError as error:
        print(f'An error occurred: {error}')
        return None

def fetch_and_process_events(service):
    # Setup the time bounds to include all of last year and up to 1 month ahead
    time_min = '2025-01-01T00:00:00Z'
    now = datetime.datetime.now(datetime.timezone.utc)
    one_month_ahead = now + datetime.timedelta(days=30) 
    time_max = f'{one_month_ahead.isoformat()}'
    
    print(f"Fetching calendar events between {time_min} and {time_max}...")
    
    events_result = service.events().list(
        calendarId='primary', 
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    events = events_result.get('items', [])

    if not events:
        print('No upcoming events found in this date range.')
        return

    # Process into daily aggregations
    daily_stats = {}

    for event in events:
        start = event['start'].get('dateTime', event['start'].get('date'))
        end = event['end'].get('dateTime', event['end'].get('date'))
        summary = event.get('summary', 'Busy')
        
        # Handle full-day events (they only have 'date' and no 'dateTime')
        if 'T' not in start:
            date_str = start
            duration_hours = 24
        else:
            date_str = start[:10]
            # Calculate duration
            fmt = "%Y-%m-%dT%H:%M:%S%z"
            # Some dates come without timezone shift, some with Z
            try:
                start_dt = datetime.datetime.fromisoformat(start)
                end_dt = datetime.datetime.fromisoformat(end)
                duration_hours = (end_dt - start_dt).total_seconds() / 3600.0
            except ValueError:
                duration_hours = 1.0 # fallback
        
        if date_str not in daily_stats:
            daily_stats[date_str] = {
                'date': date_str,
                'total_events': 0,
                'busy_hours': 0.0,
                'event_names': []
            }
            
        daily_stats[date_str]['total_events'] += 1
        daily_stats[date_str]['busy_hours'] += duration_hours
        daily_stats[date_str]['event_names'].append(summary)

    # Convert to list and save
    output_data = list(daily_stats.values())
    
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump({
            "sync_time": datetime.datetime.now().isoformat(),
            "daily_calendar": output_data
        }, f, indent=2)
        
    print(f"Successfully processed {len(events)} events.")
    print(f"Saved aggregated daily metrics to {OUTPUT_FILE}")

if __name__ == '__main__':
    svc = get_calendar_service()
    if svc:
        fetch_and_process_events(svc)
