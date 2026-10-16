# Administration INOX PRÉSENCE

Panel Next.js de l'administration. L'authentification exige un compte invité, un mot de passe et un facteur TOTP validé (`aal2`). Les rôles et l'état actif proviennent des `app_metadata` Supabase, contrôlées sur le serveur à chaque accès sensible.

## Frontière de sécurité

Le navigateur ne reçoit que l'URL et la clé publiable Supabase. La clé secrète est utilisée uniquement dans les routes serveur pour les invitations. Le panel ne doit pas accéder directement aux tables métier de pointage ni à Redis : ces opérations appartiennent à `pointage-api`.

La création d'un membre passe par une invitation émise par un propriétaire ou un administrateur authentifié en `aal2`. Le QR d'invitation contient un lien à jeton haché ; `/auth/confirm` vérifie le jeton côté serveur et établit la session dans les cookies avant l'activation TOTP. Ce QR n'est pas le secret TOTP personnel de l'invité.

## Mise en route

Configurer `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY` dans l'environnement serveur. Ne jamais préfixer la clé secrète avec `NEXT_PUBLIC_` ni la committer.

```bash
npm ci
npm run lint
npm run build
```

En production, configurer l'URL du site Supabase Auth sur l'origine du panel et interdire les inscriptions publiques. La protection contre les mots de passe compromis dépend du forfait Supabase ; à défaut, imposer au moins 12 caractères et conserver le TOTP obligatoire.

Le tableau de bord métier et l'API de pointage ne sont pas encore opérationnels. Ne pas mettre le système en service pour la présence réelle sur la seule base d'un déploiement Vercel `READY`.
