# Mettre en route la base en ligne (Supabase)

À faire une seule fois, dans le projet Supabase `stickmate` (région Central EU, Frankfurt).

## 1. Créer la table

SQL Editor > New query > coller tout `schema.sql` > Run. Le message attendu est « Success. No rows returned ».

## 2. Adresse de l'app pour les liens envoyés par mail

Authentication > URL Configuration :

- Site URL : `https://geoffreyducobu-zaid.github.io/banc-hockey/`
- Redirect URLs > Add URL : `https://geoffreyducobu-zaid.github.io/banc-hockey/**`

Sans ça, le lien de confirmation et celui du mot de passe oublié renvoient vers une page qui ne marche pas.

## 3. Mots de passe

Authentication > Sign In / Providers > Email : « Confirm email » doit être activé (c'est le cas par défaut). Minimum password length : 8.

## 4. Emails en français (facultatif)

Authentication > Emails > Templates.

**Confirm signup**, sujet : `Confirme ton compte Banc`

```html
<h2>Bienvenue sur Banc</h2>
<p>Touche le lien ci-dessous pour confirmer ton adresse email :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon compte</a></p>
<p>Ensuite, ouvre l'app et connecte-toi avec ton email et ton mot de passe.</p>
<p>Si tu n'as pas créé de compte, ignore ce message.</p>
```

**Reset password**, sujet : `Ton nouveau mot de passe Banc`

```html
<h2>Mot de passe oublié</h2>
<p>Touche le lien ci-dessous pour choisir un nouveau mot de passe :</p>
<p><a href="{{ .ConfirmationURL }}">Choisir un nouveau mot de passe</a></p>
<p>Si tu n'as rien demandé, ignore ce message : ton mot de passe ne change pas.</p>
```

## Limites du plan gratuit

- 500 Mo de base, 50 000 comptes : largement assez.
- Le projet se met en pause après 7 jours sans aucune connexion. On le relance d'un clic dans le tableau de bord (les données restent).
- Les emails envoyés par Supabase sont limités à quelques-uns par heure. Assez pour 3-5 coachs ; pour plus, brancher un service d'email (Resend, Brevo…) dans Authentication > Emails > SMTP Settings.

## Ce qui ne va jamais dans l'app ni dans le chat

Le mot de passe de la base, la clé `secret` ou `service_role`. Seules l'adresse du projet et la clé `publishable` (ou `anon`) vont dans `config.js`.
