-- get_repositories returns all available repositories that belong to the
-- provided user as a json array.
create or replace function get_user_repositories(
    p_user_id uuid,
    p_include_credentials boolean,
    p_limit int,
    p_offset int
) returns table(data json, total_count bigint) as $$
    select
        coalesce(json_agg(rJSON), '[]'),
        (select count(*) from repository where user_id = p_user_id)
    from (
        select rJSON
        from repository r
        cross join get_repository_by_id(r.repository_id, p_include_credentials) as rJSON
        where user_id is not null
        and user_id = p_user_id
        order by r.name asc
        limit (case when p_limit = 0 then null else p_limit end)
        offset p_offset
    ) rs;
$$ language sql;
