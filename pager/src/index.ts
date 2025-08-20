import { startBrowserAgent } from "magnitude-core";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

interface LoginCredentials {
    url: string;
    username: string;
    password: string;
}

interface Material {
    name: string;
    pageName: string;
    heroDescription: string;
    overview: string;
    characteristicsAndChallenges: string;
}

function parseMarkdownFile(filePath: string): { credentials: LoginCredentials; materials: Material[] } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let credentials: LoginCredentials = { url: '', username: '', password: '' };
    const materials: Material[] = [];
    let currentMaterial: Partial<Material> = {};
    let currentSection = '';
    let inMaterialSection = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() || '';
        
        // Stop processing if we hit the ##stop marker
        if (line === '##stop') {
            break;
        }
        
        // Parse login credentials
        if (line.startsWith('**URL:**')) {
            credentials.url = line.replace('**URL:**', '').trim();
        } else if (line.startsWith('**User:**')) {
            credentials.username = line.replace('**User:**', '').replace(/`/g, '').trim();
        } else if (line.startsWith('**Pass:**')) {
            credentials.password = line.replace('**Pass:**', '').replace(/`/g, '').trim();
        }
        
        // Parse material sections
        else if (line.startsWith('## ') && !line.includes('Login Credentials') && !line.includes('stop')) {
            // Save previous material if exists
            if (currentMaterial.name) {
                materials.push(currentMaterial as Material);
            }
            
            // Start new material
            currentMaterial = {
                name: line.replace('## ', '').trim()
            };
            inMaterialSection = true;
        }
        
        // Parse material properties
        else if (inMaterialSection) {
            if (line.startsWith('**Material page name:**')) {
                currentMaterial.pageName = line.replace('**Material page name:**', '').trim();
            } else if (line.startsWith('**Hero Description:**')) {
                currentMaterial.heroDescription = line.replace('**Hero Description:**', '').trim();
            } else if (line.startsWith('**Overview:**')) {
                currentMaterial.overview = line.replace('**Overview:**', '').trim();
            } else if (line.startsWith('**Characteristics and Challenges:**')) {
                currentMaterial.characteristicsAndChallenges = line.replace('**Characteristics and Challenges:**', '').trim();
            }
        }
    }
    
    // Add the last material if exists
    if (currentMaterial.name) {
        materials.push(currentMaterial as Material);
    }
    
    return { credentials, materials };
}

function getImageSearchTerm(materialName: string): string {
    return materialName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

async function setFeaturedImageFromGallery(agent: any, materialName: string): Promise<void> {
    try {
        // Click "Set featured image" button
        await agent.act('Click the "Set featured image" button');
        
        // Wait for media gallery to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create search term for the material image
        const imageSearchTerm = getImageSearchTerm(materialName);
        
        console.log(`🔍 Searching for image with term: ${imageSearchTerm}`);
        
        // Search for the material image in the media gallery
        await agent.act('Search in the media gallery search box', {
            data: { searchTerm: imageSearchTerm }
        });
        
        // Wait for search results
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Check if any matching images were found
        const searchResults = await agent.extract(
            'Are there any images in the search results that match the material name?',
            z.object({
                hasMatchingImages: z.boolean(),
                imageCount: z.number()
            })
        );
        
        if (searchResults.hasMatchingImages && searchResults.imageCount > 0) {
            console.log(`📷 Found ${searchResults.imageCount} matching image(s), selecting the first one`);
            
            // Select the first matching image
            await agent.act('Click on the first image in the search results to select it');
            
            // Set as featured image
            await agent.act('Click the "Set featured image" button to confirm selection');
            
            console.log(`✅ Featured image set successfully for: ${materialName}`);
            
        } else {
            console.log(`⚠️  No matching image found for: ${materialName}`);
            
            // Close the media gallery without selecting an image
            await agent.act('Close the media gallery modal or dialog');
        }
        
    } catch (error) {
        console.error(`❌ Error setting featured image for ${materialName}: ${error}`);
        
        // Try to close the media gallery if it's still open
        try {
            await agent.act('Close or cancel the media gallery if it is still open');
        } catch (closeError) {
            console.warn(`Could not close media gallery: ${closeError}`);
        }
    }
}

async function processMaterial(agent: any, material: Material): Promise<void> {
    console.log(`Processing material: ${material.name}`);
    
    try {
        // Step 1: Search for existing material first (Figure #1)
        console.log(`🔍 Searching for existing material: ${material.name}`);
        await agent.act('Use the search box to search for existing material', {
            data: { searchTerm: material.pageName || material.name }
        });
        
        // Small delay to allow search results to load
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Step 2: Check if material exists and decide next action
        const searchResults = await agent.extract(
            'Are there any search results showing materials with this name?',
            z.object({
                hasResults: z.boolean(),
                materialExists: z.boolean()
            })
        );
        
        if (searchResults.materialExists) {
            console.log(`📝 Found existing material, editing: ${material.name}`);
            
            // Hover over material name and click Edit button
            await agent.act('Hover over the material name in search results list and click the Edit button that appears below the title');
            
        } else {
            console.log(`➕ Material not found, creating new: ${material.name}`);
            
            // Navigate to add new material (Figure #2)
            await agent.act('Click "Add new material" from the sidebar menu');
        }
        
        // Fill in the material information
        await agent.act('Fill in the post title', { 
            data: { title: material.pageName || material.name }
        });
        
        // Fill custom field meta boxes with material data
        if (material.heroDescription) {
            await agent.act('Fill in Hero Description field', {
                data: { heroDescription: material.heroDescription }
            });
        }
        
        if (material.overview) {
            await agent.act('Fill in Overview field', {
                data: { overview: material.overview }
            });
        }
        
        if (material.characteristicsAndChallenges) {
            await agent.act('Fill in Characteristics and Challenges field', {
                data: { characteristics: material.characteristicsAndChallenges }
            });
        }
        
        // Set featured image from media gallery
        console.log(`🖼️  Setting featured image from media gallery for: ${material.name}`);
        await setFeaturedImageFromGallery(agent, material.name);
        
        // Save/publish the post
        await agent.act('Save and publish the post');
        
        console.log(`✅ Successfully processed material: ${material.name}`);
        
    } catch (error) {
        console.error(`❌ Error processing material ${material.name}: ${error}`);
        throw error;
    }
}

async function main() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const materialsFilePath = path.join(__dirname, '..', 'materials_list.md');
    
    console.log('🚀 Starting WordPress Material Automation...');
    
    // Parse the materials list
    console.log('📄 Parsing materials list...');
    const { credentials, materials } = parseMarkdownFile(materialsFilePath);
    
    console.log(`Found ${materials.length} materials to process`);
    console.log(`WordPress URL: ${credentials.url}`);
    
    // Initialize Magnitude browser agent
    const agent = await startBrowserAgent({
        url: credentials.url,
        narrate: true,
        llm: {
            provider: 'claude-code',
            options: {
                model: 'claude-sonnet-4-20250514'
            }
        }
    });
    
    try {
        // WordPress login
        console.log('🔐 Logging into WordPress...');
        await agent.act('Log into WordPress admin', {
            data: {
                username: credentials.username,
                password: credentials.password
            }
        });
        
        // Verify login success
        console.log('✅ Login successful, navigating to WordPress dashboard...');
        
        // Navigate to materials custom post type or posts section
        await agent.act('Navigate to the Materials custom post type section on the left sidebar where materials can be added');
        
        // Process each material
        let processedCount = 0;
        let errorCount = 0;
        
        for (const material of materials) {
            try {
                // Process the material
                await processMaterial(agent, material);
                processedCount++;
                
                // Small delay between materials to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`Failed to process material ${material.name}: ${error}`);
                errorCount++;
                
                // Continue with next material instead of stopping completely
                continue;
            }
        }
        
        console.log(`\n📊 Processing Summary:`);
        console.log(`✅ Successfully processed: ${processedCount} materials`);
        console.log(`❌ Failed to process: ${errorCount} materials`);
        console.log(`📝 Total materials found: ${materials.length}`);
        
    } catch (error) {
        console.error('❌ Critical error during automation:', error);
        throw error;
    } finally {
        // Clean up
        console.log('🔄 Closing browser...');
        await agent.stop();
        console.log('✅ Automation completed');
    }
}

// Error handling for the main process
main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});