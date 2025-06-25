#!/usr/bin/env python3

import requests
from django.http import HttpResponse

def get_user_data(user_id):
    print(f"Getting data for user {user_id}")  # Debug statement
    response = requests.get(f"https://api.example.com/users/{user_id}")
    return response.json()

def process_data(data):
    # Long line that violates PEP8
    result = data.get("name", "").upper() + " - " + data.get("email", "").lower() + " - " + str(data.get("age", 0)) + " years old"
    return result

class UserView:
    def handle_request(self, request):
        user_id = request.GET.get('id')
        data = get_user_data(user_id)
        processed = process_data(data)
        return HttpResponse(processed)