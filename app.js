// cPanel & Passenger Default Application Entrypoint
// This ensures the application starts whether cPanel uses 'app.js' or 'server.js' as the startup file.
require('./server.js');
