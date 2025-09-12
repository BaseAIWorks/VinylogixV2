
// Import the individual modules to avoid potential conflicts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

function initializeFirebaseAdmin(): App | null {
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    console.warn('Firebase Admin SDK should only be used on the server side.');
    return null;
  }

  try {
    // Check if already initialized
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      if (!adminDb) {
        adminDb = getFirestore(adminApp);
      }
      console.log('Using existing Firebase Admin app');
      return adminApp;
    }

    // Service account configuration
    const serviceAccountConfig = {
      type: "service_account",
      project_id: "vinylogix-v1",
      private_key_id: "f692e7f9332dd0b6fd60046b48d0be59976f7155",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC8oZMtbobgGFVA\nnNeG/IjF+axPxVOwBHsdAzbWIZpfxQXORIwjLvL7/areRhnOYD/fwyBjDA9q0W+B\nXU9cvKa+VxkWK5nRGGgJTYBw1/FvpSv+YIwmZcBsIWrmSy5sixovE1Ay6CS2Yeoi\nu7fY+Egl8gDBvwX+pODohRkbuxhPEQwJ1zVemMYUAyk2sVau+R6HtBGp6GGtrCSX\nJ8EvT37EYAfxcKlEbfkuaMXEWM24iXm5MY+7wpSFm/FhmFmtt2XFdRUnUlA3DGL2\nj83UFtXsJBAis04X92TY1GOVBGBLCl2DcsUBdgpx6N8eQFzuAXm9aLpdoL77J8/Y\nvW4hxxRHAgMBAAECggEAD2SQAhEW6IqTymYCIH3TG3S4XvoXTjHPahqtCuRLGK2X\nP7HQTb6zDWUx4FmQGYs5KyVdKzf8uhbFJqVaqJKseLPa1DhSoQGA2+F7LboxdY7g\n/C0cwrVi8m/3rTtNWoYvaNAGp2DSPh/XX2Y6JnZ8TLxm22ifMJx7zf2ugtjNrwXt\nAfQa2y1Zt9aecEW0PLv+RAHWDz7KlYYLtdbEVRJa8DDYzkv0+Zh+xd8X1uzCgIkg\nJ3Pn+Et2QclUWYQ3xqdMGkqBG/EOaN9lhEFhHN/6Mg9JfsdkW7O2iZbZBkt2Up1z\nwQWaDZvRW8fjHYdzJmlzMkufaUd8ITR3VHqP0VZ+AQKBgQD17jNWPwdP2oi52awN\npeTAbhvl2uEnktxM1guTX5Mw/xlGJVXOpcNpSqsDzJVIGcw8bmdclXtoISL8MqNj\nbGFUZX9PMCj4sbOmwy6uR0ceBgPMBCZZI/TI1R5wTEroTdLM7EPXECK9+Tq66Oo3\nPWg/jWfulP7XSDf1jasbj3t5hwKBgQDEWsXqQ10ljqr11K9KEU1IdqVIq1+ZoolS\nTYhy8Oxc93PlpND654wZoyAX18JOB+A+/Nt1xc13MuaR3SupVkBMp9RLTi2iGmsA\nksk4JGf790mlSfj9OtoZ8RJOj+3nIsGx+uBHNQR2ClT3t/12ZwtEuxHBZqaf3QhV\n8JsFOJM/QQKBgB9ATbW//KXhF07Gol55nj/1vgXPcp0cxHHfIUlw87teL1ACnozL\n87EFlAW/kZi/7nwfa3MQa8Ynr9JsfOa9dwDKhQsDC7HOow2l7+Clnhvql8DtJhJd\nx1Vd/6g1ia9LdGYl/9jsa/3IFfZ6cojifMTWq0ZeGKQywSmq/vtZmE8xAoGAR/UA\nDK6tJwNWkYpkxp76lHCud6gd+7591oSFWaIC7LreZSz2TMyoIgkOzM4L7e6i9lJR\n1qIrfuBPcOr9giwSmkTy3roCrSJDTk18oi9tUAA6o/Es5xg3L0SSMeo7A/ZPx3qp\n0E6UmPGGW9W4dDik/4YSpq6Ip5Mn596p4Mrv40ECgYBcGilRSSo6c3/A1yHt1KMp\nuyS7ZIuCE6cEkTjV0hicSgU0mbVbicMDvcch5s8RE6WbFxTXz62L/NY/0QRBTpn8\nfePvBelU1w5pb/qH1AHJwwJcIFq/37Tp42o0IBcfH58K0EO8vUgxxkniwEkZhbQc\nLw8kfCuYKhheWRQJ4VzJ4w==\n-----END PRIVATE KEY-----\n",
      client_email: "firebase-adminsdk-fbsvc@vinylogix-v1.iam.gserviceaccount.com",
      client_id: "115325643121153075134",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40vinylogix-v1.iam.gserviceaccount.com",
      universe_domain: "googleapis.com"
    };

    console.log('Initializing Firebase Admin SDK...');
    
    adminApp = initializeApp({
      credential: cert(serviceAccountConfig as any),
      projectId: "vinylogix-v1",
    });
    
    adminDb = getFirestore(adminApp);
    console.log('Firebase Admin SDK initialized successfully!');
    return adminApp;
    
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error);
    adminApp = null;
    adminDb = null;
    return null;
  }
}

export function getAdminDb(): Firestore | null {
  if (!adminDb && !adminApp) {
    initializeFirebaseAdmin();
  }
  
  if (!adminDb) {
    console.warn("Firebase Admin SDK is not available. Admin operations will fail.");
  }
  
  return adminDb;
}

export function getAdminAuth() {
  if (!adminApp) {
    initializeFirebaseAdmin();
  }
  
  return adminApp ? getAuth(adminApp) : null;
}
