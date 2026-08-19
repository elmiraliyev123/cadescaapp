update public.oauth_clients
set allowed_scopes = array['openid', 'profile', 'email', 'university'],
    updated_at = now()
where client_id = 'bilmatch';

insert into public.oauth_clients (
    client_id, name, client_type, redirect_uris, allowed_scopes, access_policy
) values (
    'bilmatch-local',
    'BilMatch Local Development',
    'public',
    array['http://127.0.0.1:8000/auth/cadesca/callback'],
    array['openid', 'profile', 'email', 'university'],
    'active_user'
)
on conflict (client_id) do update
set redirect_uris = excluded.redirect_uris,
        allowed_scopes = excluded.allowed_scopes,
        access_policy = excluded.access_policy,
        status = 'active',
        updated_at = now();
