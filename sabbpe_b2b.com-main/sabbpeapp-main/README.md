# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/a10d7060-4e8f-4014-987b-50eb2b918246

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/a10d7060-4e8f-4014-987b-50eb2b918246) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Environment Variables

The frontend relies on a handful of `VITE_`-prefixed variables in `.env.local` at the project root. Vite exposes only values starting with `VITE_` to the browser – if you forget the prefix the app will crash during startup and result in a blank page.

Example values you must provide (replace with real secrets/URLs):

```env
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key          # 👈 DO NOT leave the placeholder text "REPLACE_WITH_PROJECT_ANON_KEY"
VITE_API_URL=https://onboardinguatbckend.sabbpe.com   # no need to include trailing `/api`; the client adds it automatically
# other keys used by client code:
# VITE_GOOGLE_VISION_API_KEY=
# VITE_MSG91_AUTHKEY=
```

> ⚠️ **Important:** The default `.env.local` shipped with this repo contains a literal
> `REPLACE_WITH_PROJECT_ANON_KEY` string. If you forget to substitute a real
> anon key the app will run but every auth/DB request will fail with "Invalid
> API key". The development build now throws an error at startup when the
> placeholder is detected so you can’t accidentally proceed with a bogus value.

Do **not** expose service‑role keys or other sensitive server secrets in any `VITE_` variable; those belong in backend-only environment variables (no prefix).

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/a10d7060-4e8f-4014-987b-50eb2b918246) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
