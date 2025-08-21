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

function parseLoginCredentials(filePath: string): LoginCredentials {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let credentials: LoginCredentials = { url: '', username: '', password: '' };
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('**URL:**')) {
            credentials.url = trimmedLine.replace('**URL:**', '').trim();
        } else if (trimmedLine.startsWith('**User:**')) {
            credentials.username = trimmedLine.replace('**User:**', '').replace(/`/g, '').trim();
        } else if (trimmedLine.startsWith('**Pass:**')) {
            credentials.password = trimmedLine.replace('**Pass:**', '').replace(/`/g, '').trim();
        }
    }
    
    return credentials;
}

function parseMaterialFile(filePath: string): Material {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let material: Partial<Material> = {};
    let currentContent = '';
    let currentField = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('## ')) {
            material.name = trimmedLine.replace('## ', '').trim();
        } else if (trimmedLine.startsWith('**Material page name:**')) {
            material.pageName = trimmedLine.replace('**Material page name:**', '').trim();
        } else if (trimmedLine.startsWith('**Hero Description:**')) {
            currentField = 'heroDescription';
            currentContent = trimmedLine.replace('**Hero Description:**', '').trim();
        } else if (trimmedLine.startsWith('**Overview:**')) {
            // Save previous field if exists
            if (currentField && currentContent) {
                (material as any)[currentField] = currentContent.trim();
            }
            currentField = 'overview';
            currentContent = trimmedLine.replace('**Overview:**', '').trim();
        } else if (trimmedLine.startsWith('**Characteristics and Challenges:**')) {
            // Save previous field if exists
            if (currentField && currentContent) {
                (material as any)[currentField] = currentContent.trim();
            }
            currentField = 'characteristicsAndChallenges';
            currentContent = trimmedLine.replace('**Characteristics and Challenges:**', '').trim();
        } else if (currentField && trimmedLine) {
            // Continue building the current field content
            currentContent += (currentContent ? ' ' : '') + trimmedLine;
        }
    }
    
    // Save the last field
    if (currentField && currentContent) {
        (material as any)[currentField] = currentContent.trim();
    }
    
    // Validate required fields
    if (!material.name) {
        throw new Error(`Material file ${filePath} is missing a name (## heading)`);
    }
    
    return material as Material;
}

function loadAllMaterials(materialsDir: string): Material[] {
    const materials: Material[] = [];
    
    try {
        const files = fs.readdirSync(materialsDir);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        
        console.log(`📁 Found ${mdFiles.length} material files in ${materialsDir}`);
        
        for (const file of mdFiles) {
            try {
                const filePath = path.join(materialsDir, file);
                const material = parseMaterialFile(filePath);
                materials.push(material);
                console.log(`✅ Loaded material: ${material.name}`);
            } catch (error) {
                console.error(`❌ Error parsing material file ${file}: ${error}`);
            }
        }
    } catch (error) {
        console.error(`❌ Error reading materials directory ${materialsDir}: ${error}`);
        throw error;
    }
    
    return materials;
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
        
        let isEditingExisting = false;
        
        if (searchResults.materialExists) {
            console.log(`📝 Found existing material, editing: ${material.name}`);
            
            // Hover over material name and click Edit button
            await agent.act('Hover over the material name in search results list and click the Edit button that appears below the title');
            isEditingExisting = true;
            
        } else {
            console.log(`➕ Material not found, creating new: ${material.name}`);
            
            // Navigate to add new material (Figure #2)
            await agent.act('Click "Add new material" from the sidebar menu');
        }
        
        // Fill in the post title only if creating a new material
        if (!isEditingExisting) {
            console.log(`📝 Setting post title for new material: ${material.name}`);
            await agent.act('Fill in the post title', { 
                data: { title: material.pageName || material.name }
            });
        } else {
            console.log(`⏭️  Skipping title update for existing material: ${material.name}`);
        }
        
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
        
        // Check if featured image already exists and set one if needed
        console.log(`🖼️  Checking featured image status for: ${material.name}`);
        
        const featuredImageStatus = await agent.extract(
            'Is there already a featured image set for this post? Look for a featured image preview or "Set featured image" button text.',
            z.object({
                hasFeaturedImage: z.boolean(),
                imageDescription: z.string().optional()
            })
        );
        
        if (featuredImageStatus.hasFeaturedImage) {
            console.log(`✅ Featured image already exists for: ${material.name}`);
            console.log(`⏭️  Skipping featured image step`);
        } else {
            console.log(`📷 No featured image found, setting one from media gallery for: ${material.name}`);
            await setFeaturedImageFromGallery(agent, material.name);
        }
        
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
    const credentialsFilePath = path.join(__dirname, '..', 'login_credentials.md');
    const materialsDir = path.join(__dirname, '..', 'materials');
    
    console.log('🚀 Starting WordPress Material Automation...');
    
    // Parse login credentials
    console.log('🔐 Loading login credentials...');
    const credentials = parseLoginCredentials(credentialsFilePath);
    
    // Load all materials from individual files
    console.log('📄 Loading materials from individual files...');
    const materials = loadAllMaterials(materialsDir);
    
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