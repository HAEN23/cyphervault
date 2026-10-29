import crypto from 'crypto';


const ALGORITHM = 'aes-256-cbc';


const getEncryptionKey = () => {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY no está definida en las variables de entorno");
  }
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
};


export function encryptData(text: string) {
  
  const iv = crypto.randomBytes(16);
  
 
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
 
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted
  };
}


export function decryptData(encryptedData: string, ivHex: string) {
  const iv = Buffer.from(ivHex, 'hex');
  
  // Creamos el descifrador
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  // Revertimos el código cifrado a texto plano
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}