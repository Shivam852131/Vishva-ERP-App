# Vishva ERP Frontend

React Native frontend with a standard `index.js` + `App.tsx` entry and React Navigation-based routing.

## Commands

```bash
npm install
npm start
npm run android
npm run ios
npm run lint
```

## Notes

- `App.tsx` owns the navigation tree.
- `src/navigation/router.ts` provides simple path-style helpers used by the screens.
- Some former Expo runtime features now use lightweight compatibility shims in `src/native/`.
