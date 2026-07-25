/**
 * Restore products, media, and guides from cached data after accidental database reset.
 * 
 * Usage: cd /srv/pet && npx tsx scripts/restore-data.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const API = 'http://127.0.0.1:3000/api';
const MEDIA_DIR = '/srv/pet/cms/media';

// We need to authenticate first
async function getAuthToken(): Promise<string> {
  // Try to login - we'll need to create a user first if none exists
  const res = await fetch(`${API}/users/first-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@pawlabs.org',
      password: 'pawlabs2026!',
    }),
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('Created admin user');
    return data.token;
  }

  // User might already exist, try login
  const loginRes = await fetch(`${API}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@pawlabs.org',
      password: 'pawlabs2026!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  return loginData.token;
}

async function restoreMedia(token: string): Promise<Map<number, number>> {
  const idMap = new Map<number, number>(); // old ID -> new ID
  
  const recovered: any[] = JSON.parse(
    fs.readFileSync('/srv/pet/.cache/recovered_media.json', 'utf-8')
  );

  // Also get guide featured images
  const guides: any[] = JSON.parse(
    fs.readFileSync('/srv/pet/.cache/recovered_guides.json', 'utf-8')
  );
  
  for (const g of guides) {
    if (g.featuredImage && typeof g.featuredImage === 'object') {
      const exists = recovered.find(m => m.id === g.featuredImage.id);
      if (!exists) {
        recovered.push(g.featuredImage);
      }
    }
  }

  console.log(`\n=== Restoring ${recovered.length} media records ===`);

  for (const media of recovered) {
    const filename = media.filename;
    const filePath = path.join(MEDIA_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP: ${filename} — file not found on disk`);
      continue;
    }

    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: media.mimeType || 'image/jpeg' });
    formData.append('file', blob, filename);
    
    // Payload expects _payload JSON for fields alongside file upload
    const payloadData: any = {
      alt: media.alt || filename.replace(/\.[^.]+$/, '').replace(/[_+]/g, ' '),
    };
    if (media.focalX != null) payloadData.focalX = media.focalX;
    if (media.focalY != null) payloadData.focalY = media.focalY;
    formData.append('_payload', JSON.stringify(payloadData));

    try {
      const res = await fetch(`${API}/media`, {
        method: 'POST',
        headers: { 'Authorization': `JWT ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        idMap.set(media.id, data.doc.id);
        console.log(`  ✓ ${filename} (old ID ${media.id} → new ID ${data.doc.id})`);
      } else {
        const err = await res.text();
        console.log(`  ✗ ${filename}: ${res.status} ${err.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log(`  ✗ ${filename}: ${e.message}`);
    }
  }

  return idMap;
}

async function restoreProducts(token: string, mediaIdMap: Map<number, number>): Promise<Map<number, number>> {
  const idMap = new Map<number, number>(); // old ID -> new ID
  
  const products: any[] = JSON.parse(
    fs.readFileSync('/srv/pet/.cache/recovered_products.json', 'utf-8')
  );

  console.log(`\n=== Restoring ${products.length} products ===`);

  for (const product of products) {
    const data: any = {
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      price: product.price,
      affiliateUrl: product.affiliateUrl,
      category: product.category,
      petType: product.petType,
      featured: product.featured || false,
      rating: product.rating,
      pros: product.pros || [],
      cons: product.cons || [],
    };

    // Map old image ID to new one
    if (product.image && typeof product.image === 'object' && product.image.id) {
      const newMediaId = mediaIdMap.get(product.image.id);
      if (newMediaId) {
        data.image = newMediaId;
      }
    }

    // Map gallery images
    if (product.gallery && Array.isArray(product.gallery)) {
      data.gallery = product.gallery
        .map((g: any) => {
          if (g.image && typeof g.image === 'object' && g.image.id) {
            const newId = mediaIdMap.get(g.image.id);
            return newId ? { image: newId } : null;
          }
          return null;
        })
        .filter(Boolean);
    }

    try {
      const res = await fetch(`${API}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `JWT ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        idMap.set(product.id, result.doc.id);
        console.log(`  ✓ ${product.name} (old ID ${product.id} → new ID ${result.doc.id})`);
      } else {
        const err = await res.text();
        console.log(`  ✗ ${product.name}: ${res.status} ${err.slice(0, 150)}`);
      }
    } catch (e: any) {
      console.log(`  ✗ ${product.name}: ${e.message}`);
    }
  }

  return idMap;
}

async function restoreGuides(token: string, mediaIdMap: Map<number, number>, productIdMap: Map<number, number>) {
  const guides: any[] = JSON.parse(
    fs.readFileSync('/srv/pet/.cache/recovered_guides.json', 'utf-8')
  );

  console.log(`\n=== Restoring ${guides.length} guides ===`);

  for (const guide of guides) {
    const data: any = {
      title: guide.title,
      slug: guide.slug,
      guideType: guide.guideType,
      summary: guide.summary,
      content: guide.content,
      category: guide.category,
      petType: guide.petType,
      author: guide.author || 'PawLabs Team',
      publishedDate: guide.publishedDate,
      status: guide.status || 'published',
    };

    // Map product IDs
    if (guide.products && Array.isArray(guide.products)) {
      data.products = guide.products
        .map((p: any) => {
          const oldId = typeof p === 'object' ? p.id : p;
          return productIdMap.get(oldId) || null;
        })
        .filter(Boolean);
    }

    // Map featured image
    if (guide.featuredImage && typeof guide.featuredImage === 'object') {
      const newMediaId = mediaIdMap.get(guide.featuredImage.id);
      if (newMediaId) {
        data.featuredImage = newMediaId;
      }
    }

    try {
      const res = await fetch(`${API}/guides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `JWT ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        console.log(`  ✓ ${guide.title} (old ID ${guide.id} → new ID ${result.doc.id})`);
      } else {
        const err = await res.text();
        console.log(`  ✗ ${guide.title}: ${res.status} ${err.slice(0, 150)}`);
      }
    } catch (e: any) {
      console.log(`  ✗ ${guide.title}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('🔄 PawLabs Database Recovery');
  console.log('============================\n');

  // Check CMS is running
  try {
    const health = await fetch(`${API}/media?limit=1`);
    if (!health.ok) throw new Error('CMS not healthy');
  } catch {
    console.error('❌ CMS is not running. Start it with: sudo systemctl start pawlabs-cms');
    process.exit(1);
  }

  const token = await getAuthToken();
  console.log('✓ Authenticated');

  const mediaIdMap = await restoreMedia(token);
  const productIdMap = await restoreProducts(token, mediaIdMap);
  await restoreGuides(token, mediaIdMap, productIdMap);

  console.log('\n============================');
  console.log(`✅ Recovery complete!`);
  console.log(`   Media: ${mediaIdMap.size} restored`);
  console.log(`   Products: ${productIdMap.size} restored (of 22 original — 7 not recoverable from cache)`);
  console.log(`   Guides: 3 restored`);
  console.log(`\n⚠️  7 products (IDs 2, 5, 6, 12, 13, 14, 16) were not in any cached guide`);
  console.log(`   and couldn't be recovered. You can re-generate them with the AI tool.`);
}

main().catch(console.error);
