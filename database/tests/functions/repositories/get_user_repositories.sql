-- Start transaction and plan tests
begin;
select plan(4);

-- Declare some variables
\set user1ID '00000000-0000-0000-0000-000000000001'
\set org1ID '00000000-0000-0000-0000-000000000001'

-- Seed some data
insert into "user" (user_id, alias, email)
values (:'user1ID', 'user1', 'user1@email.com');
insert into organization (organization_id, name, display_name, description, home_url)
values (:'org1ID', 'org1', 'Organization 1', 'Description 1', 'https://org1.com');

-- No repositories at this point
select results_eq(
    $$
        select data::jsonb, total_count::integer
        from get_user_repositories('00000000-0000-0000-0000-000000000001', false, 0, 0)
    $$,
    $$
        values ('[]'::jsonb, 0)
    $$,
    'With no repositories an empty json array is returned'
);

-- Seed some chart repositories
insert into repository (
    repository_id,
    name,
    display_name,
    url,
    last_tracking_ts,
    last_tracking_errors,
    repository_kind_id,
    user_id
) values (
    '00000000-0000-0000-0000-000000000001',
    'repo1',
    'Repo 1',
    'https://repo1.com',
    '1970-01-01 00:00:00 UTC',
    'error1\nerror2\nerror3',
    0,
    :'user1ID'
);
insert into repository (
    repository_id,
    name,
    display_name,
    url,
    repository_kind_id,
    user_id
) values (
    '00000000-0000-0000-0000-000000000002',
    'repo2',
    'Repo 2',
    'https://repo2.com',
    0,
    :'user1ID'
);
insert into repository (
    repository_id,
    name,
    display_name,
    url,
    repository_kind_id,
    organization_id
) values (
    '00000000-0000-0000-0000-000000000003',
    'repo3',
    'Repo 3',
    'https://repo3.com',
    0,
    :'org1ID'
);

-- Run some tests
select results_eq(
    $$
        select data::jsonb, total_count::integer
        from get_user_repositories('00000000-0000-0000-0000-000000000001', false, 0, 0)
    $$,
    $$
        values (
            '[
                {
                    "repository_id": "00000000-0000-0000-0000-000000000001",
                    "name": "repo1",
                    "display_name": "Repo 1",
                    "url": "https://repo1.com",
                    "kind": 0,
                    "verified_publisher": false,
                    "official": false,
                    "disabled": false,
                    "scanner_disabled": false,
                    "last_tracking_ts": 0,
                    "last_tracking_errors": "error1\\nerror2\\nerror3",
                    "user_alias": "user1"
                },
                {
                    "repository_id": "00000000-0000-0000-0000-000000000002",
                    "name": "repo2",
                    "display_name": "Repo 2",
                    "url": "https://repo2.com",
                    "kind": 0,
                    "verified_publisher": false,
                    "official": false,
                    "disabled": false,
                    "scanner_disabled": false,
                    "user_alias": "user1"
                }
            ]'::jsonb,
            2)
    $$,
    'Repositories belonging to user provided are returned as a json array of objects'
);
select results_eq(
    $$
        select data::jsonb, total_count::integer
        from get_user_repositories(null, false, 0, 0)
    $$,
    $$
        values ('[]'::jsonb, 0)
    $$,
    'Repositories not belonging to any user are not returned'
);
select results_eq(
    $$
        select data::jsonb, total_count::integer
        from get_user_repositories('00000000-0000-0000-0000-000000000001', false, 1, 1)
    $$,
    $$
        values (
            '[
                {
                    "repository_id": "00000000-0000-0000-0000-000000000002",
                    "name": "repo2",
                    "display_name": "Repo 2",
                    "url": "https://repo2.com",
                    "kind": 0,
                    "verified_publisher": false,
                    "official": false,
                    "disabled": false,
                    "scanner_disabled": false,
                    "user_alias": "user1"
                }
            ]'::jsonb,
            2)
    $$,
    'Using limit and offset, only one repository belonging to user provided is returned'
);

-- Finish tests and rollback transaction
select * from finish();
rollback;
