import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fixed DNS configuration for VisualPro
const VISUALPRO_CONFIG = {
  CNAME_TARGET: 'sites.visualpro.cloud',
  A_RECORD_IP: '185.178.193.121', // IP du serveur VisualPro
  CLOUDFLARE_VERIFY: 'verify.visualpro.cloud',
};

interface DnsCheckResult {
  type: 'CNAME' | 'A' | 'TXT';
  name: string;
  expectedValue: string;
  actualValue: string | null;
  status: 'success' | 'error' | 'pending';
  message: string;
}

async function checkDnsRecord(domain: string, recordType: string, recordName: string): Promise<any> {
  try {
    const queryName = recordName === '@' ? domain : `${recordName}.${domain}`;
    const url = `https://dns.google/resolve?name=${queryName}&type=${recordType}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data;
  } catch (error) {
    console.error(`Error checking DNS record:`, error);
    return null;
  }
}

async function verifyDomainConfiguration(domain: string, verificationCode: string): Promise<{
  results: DnsCheckResult[];
  propagationPercentage: number;
  status: string;
  sslReady: boolean;
}> {
  const results: DnsCheckResult[] = [];
  let successCount = 0;
  const totalChecks = 3;

  // Check CNAME for www subdomain
  console.log('Checking CNAME record for www subdomain...');
  const cnameData = await checkDnsRecord(domain, 'CNAME', 'www');
  const cnameValue = cnameData?.Answer?.[0]?.data;
  const cnameSuccess = cnameValue?.toLowerCase().includes(VISUALPRO_CONFIG.CNAME_TARGET.toLowerCase());
  
  results.push({
    type: 'CNAME',
    name: `www.${domain}`,
    expectedValue: VISUALPRO_CONFIG.CNAME_TARGET,
    actualValue: cnameValue || null,
    status: cnameSuccess ? 'success' : (cnameValue ? 'error' : 'pending'),
    message: cnameSuccess 
      ? '✓ Enregistrement CNAME correctement configuré'
      : cnameValue 
        ? `✗ CNAME pointe vers ${cnameValue} au lieu de ${VISUALPRO_CONFIG.CNAME_TARGET}`
        : '⏳ Enregistrement CNAME non détecté - propagation DNS en cours'
  });
  
  if (cnameSuccess) successCount++;

  // Check A record for root domain
  console.log('Checking A record for root domain...');
  const aData = await checkDnsRecord(domain, 'A', '@');
  const aValue = aData?.Answer?.[0]?.data;
  const aSuccess = aValue === VISUALPRO_CONFIG.A_RECORD_IP;
  
  results.push({
    type: 'A',
    name: domain,
    expectedValue: VISUALPRO_CONFIG.A_RECORD_IP,
    actualValue: aValue || null,
    status: aSuccess ? 'success' : (aValue ? 'error' : 'pending'),
    message: aSuccess 
      ? '✓ Enregistrement A correctement configuré'
      : aValue 
        ? `✗ A record pointe vers ${aValue} au lieu de ${VISUALPRO_CONFIG.A_RECORD_IP}`
        : '⏳ Enregistrement A non détecté - propagation DNS en cours'
  });
  
  if (aSuccess) successCount++;

  // Check TXT record for verification
  console.log('Checking TXT record for verification...');
  const txtData = await checkDnsRecord(domain, 'TXT', '@');
  const txtRecords = txtData?.Answer?.map((record: any) => record.data) || [];
  const txtSuccess = txtRecords.some((record: string) => 
    record.includes(`visualpro-site-verification=${verificationCode}`)
  );
  
  results.push({
    type: 'TXT',
    name: domain,
    expectedValue: `visualpro-site-verification=${verificationCode}`,
    actualValue: txtRecords.join(', ') || null,
    status: txtSuccess ? 'success' : (txtRecords.length > 0 ? 'error' : 'pending'),
    message: txtSuccess 
      ? '✓ Enregistrement TXT de vérification détecté'
      : txtRecords.length > 0 
        ? '✗ Code de vérification incorrect dans le TXT'
        : '⏳ Enregistrement TXT non détecté - propagation DNS en cours'
  });
  
  if (txtSuccess) successCount++;

  // Calculate propagation percentage
  const propagationPercentage = Math.round((successCount / totalChecks) * 100);
  
  // Determine overall status
  let status = 'pending_verification';
  let sslReady = false;
  
  if (successCount === totalChecks) {
    status = 'verified';
    sslReady = true;
  } else if (successCount > 0) {
    status = 'partial_propagation';
  }

  return {
    results,
    propagationPercentage,
    status,
    sslReady
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { showcaseId, domain, verificationCode } = await req.json();

    if (!showcaseId || !domain || !verificationCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Verifying domain configuration for ${domain}...`);

    // Get current domain status before verification
    const { data: currentSite } = await supabaseClient
      .from('showcase_sites')
      .select('domain_status, ssl_status, business_name, owner_name, user_id')
      .eq('id', showcaseId)
      .single();

    const previousStatus = currentSite?.domain_status;
    const previousSslStatus = currentSite?.ssl_status;

    // Perform DNS verification
    const verification = await verifyDomainConfiguration(domain, verificationCode);

    // Update showcase_sites with verification results
    const newStatus = verification.status === 'verified' ? 'active' : verification.status;
    const newSslStatus = verification.sslReady ? 'active' : 'pending';

    const { error: updateError } = await supabaseClient
      .from('showcase_sites')
      .update({
        domain_status: newStatus,
        dns_propagation_percentage: verification.propagationPercentage,
        ssl_status: newSslStatus,
        domain_last_check: new Date().toISOString(),
      })
      .eq('id', showcaseId);

    if (updateError) {
      console.error('Error updating showcase:', updateError);
      throw updateError;
    }

    console.log(`Domain verification completed: ${newStatus} (${verification.propagationPercentage}%)`);

    // Send notification email if domain just became active
    const domainJustBecameActive = 
      newStatus === 'active' && 
      newSslStatus === 'active' &&
      (previousStatus !== 'active' || previousSslStatus !== 'active');

    if (domainJustBecameActive && currentSite?.user_id) {
      console.log('Domain just became active, sending notification email...');
      
      // Get user email from profiles
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('email, full_name')
        .eq('id', currentSite.user_id)
        .single();

      if (profile?.email) {
        try {
          // Call the notification edge function
          const notificationResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-domain-ready-notification`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              },
              body: JSON.stringify({
                showcaseId,
                customDomain: domain,
                businessName: currentSite.business_name,
                ownerEmail: profile.email,
                ownerName: profile.full_name || currentSite.owner_name,
              }),
            }
          );

          if (notificationResponse.ok) {
            console.log('Notification email sent successfully');
          } else {
            const errorText = await notificationResponse.text();
            console.error('Error sending notification:', errorText);
          }
        } catch (emailError) {
          console.error('Error calling notification function:', emailError);
          // Don't fail the main request if email fails
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...verification,
        status: newStatus,
        sslStatus: newSslStatus,
        config: VISUALPRO_CONFIG,
        notificationSent: domainJustBecameActive
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in verify-domain-dns function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});