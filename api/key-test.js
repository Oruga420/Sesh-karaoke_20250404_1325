// Simple API key test
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Test API key
  const testKey = "hk205-bmv8eRuDe1gzEEgGeErKZj3ETvMZke9VBV";
  
  // Get the environment key
  const envKey = process.env.HAPPI_API_KEY;
  
  // Basic response with key info
  const response = {
    timestamp: new Date().toISOString(),
    testKeyInfo: {
      available: true,
      length: testKey.length,
      preview: `${testKey.substring(0, 5)}...${testKey.substring(testKey.length - 3)}`
    },
    envKeyInfo: {
      available: !!envKey,
      length: envKey ? envKey.length : 0,
      preview: envKey ? `${envKey.substring(0, 5)}...${envKey.substring(envKey.length - 3)}` : null,
    },
    allEnvVars: Object.keys(process.env)
  };
  
  return res.status(200).json(response);
};