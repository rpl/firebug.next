/* See license.txt for terms of usage */

// RequireJS configuration
require.config({
  baseUrl: ".",
  waitSeconds: 20,
  paths: {
    "jquery": "../lib/jquery/jquery.min",
    "react": "../lib/react/react",
    "bootstrap": "../lib/bootstrap/js/bootstrap.min",
    "react-bootstrap": "../lib/react-bootstrap/react-bootstrap.min",
    "baobab": "../lib/baobab/baobab.min",
    "reps": "../reps",
  }
});

// Load the main panel module
requirejs(["editor"]);
