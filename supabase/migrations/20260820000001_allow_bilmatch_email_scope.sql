update public.oauth_clients
set allowed_scopes = array['openid', 'profile', 'email', 'university'],
    updated_at = now()
where client_id = 'bilmatch';
