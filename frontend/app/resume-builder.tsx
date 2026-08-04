import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Sparkles, FileText, Download, User, Briefcase, GraduationCap,
  Award, Plus, Trash2, ChevronDown, Eye, Edit3,
} from 'lucide-react-native';
import RNFS from 'react-native-fs';

type ResumeData = {
  name: string; email: string; phone: string; objective: string;
  education: { degree: string; school: string; year: string; gpa: string }[];
  skills: string[]; experience: { title: string; company: string; duration: string; desc: string }[];
  projects: { name: string; desc: string; tech: string }[];
  certifications: string[];
};

function generateResumeHTML(r: ResumeData): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(r.name)} - Resume</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 32px; line-height: 1.5; }
  .header { text-align: center; border-bottom: 3px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px; }
  .name { font-size: 28px; font-weight: 800; color: #0f172a; }
  .contact { font-size: 13px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 11px; font-weight: 800; color: #4F46E5; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }
  .edu-item, .exp-item, .proj-item { margin-bottom: 10px; }
  .edu-degree { font-weight: 700; font-size: 14px; }
  .edu-detail { font-size: 12px; color: #64748b; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill-tag { background: #eef2ff; color: #4338ca; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .exp-title { font-weight: 700; font-size: 14px; }
  .exp-meta { font-size: 11px; color: #64748b; }
  .exp-desc { font-size: 13px; margin-top: 4px; }
  .proj-name { font-weight: 700; font-size: 14px; }
  .proj-desc { font-size: 13px; margin-top: 2px; }
  .proj-tech { font-size: 11px; color: #4F46E5; }
  .cert-item { font-size: 13px; margin-bottom: 4px; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header"><div class="name">${esc(r.name)}</div><div class="contact">${esc(r.email)} &middot; ${esc(r.phone)}</div></div>
${r.objective ? `<div class="section"><div class="section-title">Career Objective</div><p style="font-size:13px">${esc(r.objective)}</p></div>` : ''}
${r.education.length > 0 ? `<div class="section"><div class="section-title">Education</div>${r.education.map(e => `<div class="edu-item"><div class="edu-degree">${esc(e.degree)}</div><div class="edu-detail">${esc(e.school)} &middot; ${esc(e.year)} &middot; GPA: ${esc(e.gpa)}</div></div>`).join('')}</div>` : ''}
${r.skills.filter(Boolean).length > 0 ? `<div class="section"><div class="section-title">Skills</div><div class="skills">${r.skills.filter(Boolean).map(s => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div></div>` : ''}
${r.experience.length > 0 ? `<div class="section"><div class="section-title">Experience</div>${r.experience.map(e => `<div class="exp-item"><div class="exp-title">${esc(e.title)} at ${esc(e.company)}</div><div class="exp-meta">${esc(e.duration)}</div><div class="exp-desc">${esc(e.desc)}</div></div>`).join('')}</div>` : ''}
${r.projects.length > 0 ? `<div class="section"><div class="section-title">Projects</div>${r.projects.map(p => `<div class="proj-item"><div class="proj-name">${esc(p.name)}</div><div class="proj-desc">${esc(p.desc)}</div><div class="proj-tech">${esc(p.tech)}</div></div>`).join('')}</div>` : ''}
${r.certifications.length > 0 ? `<div class="section"><div class="section-title">Certifications</div>${r.certifications.map(c => `<div class="cert-item">&bull; ${esc(c)}</div>`).join('')}</div>` : ''}
</body></html>`;
}

const DEFAULT_RESUME: ResumeData = {
  name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 9876543210',
  objective: 'Aspiring software engineer seeking to leverage strong technical skills and academic excellence in a challenging role.',
  education: [
    { degree: 'B.Tech Computer Science', school: 'Vishva University', year: '2023-2027', gpa: '8.4' },
    { degree: 'Higher Secondary', school: 'Delhi Public School', year: '2021-2023', gpa: '92%' },
  ],
  skills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'Git', 'Data Structures', 'Algorithms'],
  experience: [
    { title: 'Frontend Intern', company: 'TechCorp Solutions', duration: 'Jun-Aug 2025', desc: 'Built responsive web interfaces using React and TypeScript. Improved page load by 30%.' },
  ],
  projects: [
    { name: 'Campus ERP System', desc: 'Full-stack ERP with React Native, Node.js, PostgreSQL', tech: 'React Native, Node.js, PostgreSQL' },
    { name: 'AI Study Planner', desc: 'ML-powered study schedule optimizer', tech: 'Python, TensorFlow, Flask' },
  ],
  certifications: ['AWS Cloud Practitioner', 'Google IT Support', 'NPTEL Data Structures'],
};

export default function ResumeBuilder() {
  const [resume, setResume] = useState<ResumeData>(DEFAULT_RESUME);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const addEducation = () => {
    setResume(prev => ({ ...prev, education: [...prev.education, { degree: '', school: '', year: '', gpa: '' }] }));
  };

  const addExperience = () => {
    setResume(prev => ({ ...prev, experience: [...prev.experience, { title: '', company: '', duration: '', desc: '' }] }));
  };

  const addProject = () => {
    setResume(prev => ({ ...prev, projects: [...prev.projects, { name: '', desc: '', tech: '' }] }));
  };

  const addSkill = () => setResume(prev => ({ ...prev, skills: [...prev.skills, ''] }));

  const removeSkill = (index: number) => {
    setResume(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  const handleDownloadPDF = async () => {
    try {
      const html = generateResumeHTML(resume);
      const fileName = `Resume_${resume.name.replace(/\s+/g, '_')}_${Date.now()}`;
      const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      const filePath = `${dir}/${fileName}.html`;
      await RNFS.writeFile(filePath, html, 'utf8');
      Alert.alert(
        'Resume Saved',
        `Saved as ${fileName}.html\n\nOpen it and use Print > Save as PDF to get a PDF file.`,
        [
          { text: 'OK' },
          { text: 'Open', onPress: () => RNFS.readFile(filePath, 'utf8').then(() => {
            const { Linking } = require('react-native');
            Linking.openURL(`file://${filePath}`);
          }) },
        ],
      );
    } catch (err: any) {
      Alert.alert('Export failed', err?.message || 'Could not save the resume.');
    }
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setPreview(true);
      setGenerating(false);
    }, 1500);
  };

  const sections = [
    { key: 'personal', title: 'Personal Info', icon: User },
    { key: 'education', title: 'Education', icon: GraduationCap },
    { key: 'skills', title: 'Skills', icon: Award },
    { key: 'experience', title: 'Experience', icon: Briefcase },
    { key: 'projects', title: 'Projects', icon: FileText },
  ];

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><Sparkles size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>AI Resume Builder</Text>
                  <Text style={styles.heroSub}>Create a professional resume in minutes</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {!preview ? (
              <>
                {sections.map(s => {
                  const Icon = s.icon;
                  const isOpen = activeSection === s.key;
                  return (
                    <Card key={s.key} style={{ padding: 0, overflow: 'hidden' }}>
                      <Pressable onPress={() => setActiveSection(isOpen ? null : s.key)}
                        style={styles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Icon size={18} color={theme.colors.brand} />
                          <Text style={{ fontWeight: '700', color: theme.colors.text }}>{s.title}</Text>
                        </View>
                        <ChevronDown size={16} color={theme.colors.muted} style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
                      </Pressable>

                      {isOpen && s.key === 'personal' && (
                        <View style={styles.sectionBody}>
                          <TextInput style={styles.input} value={resume.name} onChangeText={v => setResume(p => ({ ...p, name: v }))} placeholder="Full Name" placeholderTextColor={theme.colors.muted} />
                          <TextInput style={styles.input} value={resume.email} onChangeText={v => setResume(p => ({ ...p, email: v }))} placeholder="Email" placeholderTextColor={theme.colors.muted} keyboardType="email-address" />
                          <TextInput style={styles.input} value={resume.phone} onChangeText={v => setResume(p => ({ ...p, phone: v }))} placeholder="Phone" placeholderTextColor={theme.colors.muted} keyboardType="phone-pad" />
                          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={resume.objective} onChangeText={v => setResume(p => ({ ...p, objective: v }))} placeholder="Career Objective" placeholderTextColor={theme.colors.muted} multiline />
                        </View>
                      )}

                      {isOpen && s.key === 'education' && (
                        <View style={styles.sectionBody}>
                          {resume.education.map((edu, i) => (
                            <Card key={i} style={{ padding: 12, gap: 6, backgroundColor: theme.colors.surfaceTertiary }}>
                              <TextInput style={styles.input} value={edu.degree} onChangeText={v => { const e = [...resume.education]; e[i].degree = v; setResume(p => ({ ...p, education: e })); }} placeholder="Degree" placeholderTextColor={theme.colors.muted} />
                              <TextInput style={styles.input} value={edu.school} onChangeText={v => { const e = [...resume.education]; e[i].school = v; setResume(p => ({ ...p, education: e })); }} placeholder="School/University" placeholderTextColor={theme.colors.muted} />
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TextInput style={[styles.input, { flex: 1 }]} value={edu.year} onChangeText={v => { const e = [...resume.education]; e[i].year = v; setResume(p => ({ ...p, education: e })); }} placeholder="Year" placeholderTextColor={theme.colors.muted} />
                                <TextInput style={[styles.input, { flex: 1 }]} value={edu.gpa} onChangeText={v => { const e = [...resume.education]; e[i].gpa = v; setResume(p => ({ ...p, education: e })); }} placeholder="GPA/%" placeholderTextColor={theme.colors.muted} />
                              </View>
                            </Card>
                          ))}
                          <Pressable onPress={addEducation} style={styles.addBtn}>
                            <Plus size={16} color={theme.colors.brand} /><Text style={{ color: theme.colors.brand, fontWeight: '600' }}>Add Education</Text>
                          </Pressable>
                        </View>
                      )}

                      {isOpen && s.key === 'skills' && (
                        <View style={styles.sectionBody}>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {resume.skills.map((sk, i) => (
                              <View key={i} style={styles.skillTag}>
                                <TextInput style={{ flex: 1, fontSize: 13, color: theme.colors.text }} value={sk} onChangeText={v => { const s = [...resume.skills]; s[i] = v; setResume(p => ({ ...p, skills: s })); }} placeholder="Skill" placeholderTextColor={theme.colors.muted} />
                                <Pressable onPress={() => removeSkill(i)}><Trash2 size={14} color={theme.colors.error} /></Pressable>
                              </View>
                            ))}
                          </View>
                          <Pressable onPress={addSkill} style={styles.addBtn}>
                            <Plus size={16} color={theme.colors.brand} /><Text style={{ color: theme.colors.brand, fontWeight: '600' }}>Add Skill</Text>
                          </Pressable>
                        </View>
                      )}

                      {isOpen && s.key === 'experience' && (
                        <View style={styles.sectionBody}>
                          {resume.experience.map((exp, i) => (
                            <Card key={i} style={{ padding: 12, gap: 6, backgroundColor: theme.colors.surfaceTertiary }}>
                              <TextInput style={styles.input} value={exp.title} onChangeText={v => { const e = [...resume.experience]; e[i].title = v; setResume(p => ({ ...p, experience: e })); }} placeholder="Job Title" placeholderTextColor={theme.colors.muted} />
                              <TextInput style={styles.input} value={exp.company} onChangeText={v => { const e = [...resume.experience]; e[i].company = v; setResume(p => ({ ...p, experience: e })); }} placeholder="Company" placeholderTextColor={theme.colors.muted} />
                              <TextInput style={styles.input} value={exp.duration} onChangeText={v => { const e = [...resume.experience]; e[i].duration = v; setResume(p => ({ ...p, experience: e })); }} placeholder="Duration" placeholderTextColor={theme.colors.muted} />
                              <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} value={exp.desc} onChangeText={v => { const e = [...resume.experience]; e[i].desc = v; setResume(p => ({ ...p, experience: e })); }} placeholder="Description" placeholderTextColor={theme.colors.muted} multiline />
                            </Card>
                          ))}
                          <Pressable onPress={addExperience} style={styles.addBtn}>
                            <Plus size={16} color={theme.colors.brand} /><Text style={{ color: theme.colors.brand, fontWeight: '600' }}>Add Experience</Text>
                          </Pressable>
                        </View>
                      )}

                      {isOpen && s.key === 'projects' && (
                        <View style={styles.sectionBody}>
                          {resume.projects.map((proj, i) => (
                            <Card key={i} style={{ padding: 12, gap: 6, backgroundColor: theme.colors.surfaceTertiary }}>
                              <TextInput style={styles.input} value={proj.name} onChangeText={v => { const p = [...resume.projects]; p[i].name = v; setResume(pr => ({ ...pr, projects: p })); }} placeholder="Project Name" placeholderTextColor={theme.colors.muted} />
                              <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} value={proj.desc} onChangeText={v => { const p = [...resume.projects]; p[i].desc = v; setResume(pr => ({ ...pr, projects: p })); }} placeholder="Description" placeholderTextColor={theme.colors.muted} multiline />
                              <TextInput style={styles.input} value={proj.tech} onChangeText={v => { const p = [...resume.projects]; p[i].tech = v; setResume(pr => ({ ...pr, projects: p })); }} placeholder="Technologies" placeholderTextColor={theme.colors.muted} />
                            </Card>
                          ))}
                          <Pressable onPress={addProject} style={styles.addBtn}>
                            <Plus size={16} color={theme.colors.brand} /><Text style={{ color: theme.colors.brand, fontWeight: '600' }}>Add Project</Text>
                          </Pressable>
                        </View>
                      )}
                    </Card>
                  );
                })}

                <GradientButton label={generating ? 'Generating Preview...' : 'Preview Resume'} onPress={handleGenerate} loading={generating} />
              </>
            ) : (
              <>
                <Card style={{ padding: 20, gap: 12 }}>
                  <View style={{ alignItems: 'center', paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: theme.colors.brand }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text }}>{resume.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>{resume.email} · {resume.phone}</Text>
                  </View>

                  {resume.objective && (
                    <View style={{ gap: 4 }}>
                      <Text style={styles.previewSection}>CAREER OBJECTIVE</Text>
                      <Text style={{ fontSize: 13, color: theme.colors.text, lineHeight: 18 }}>{resume.objective}</Text>
                    </View>
                  )}

                  {resume.education.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.previewSection}>EDUCATION</Text>
                      {resume.education.map((edu, i) => (
                        <View key={i} style={{ gap: 2 }}>
                          <Text style={{ fontWeight: '700', color: theme.colors.text }}>{edu.degree}</Text>
                          <Text style={{ fontSize: 12, color: theme.colors.muted }}>{edu.school} · {edu.year} · GPA: {edu.gpa}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {resume.skills.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.previewSection}>SKILLS</Text>
                      <Text style={{ fontSize: 13, color: theme.colors.text }}>{resume.skills.filter(Boolean).join(' · ')}</Text>
                    </View>
                  )}

                  {resume.experience.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.previewSection}>EXPERIENCE</Text>
                      {resume.experience.map((exp, i) => (
                        <View key={i} style={{ gap: 2 }}>
                          <Text style={{ fontWeight: '700', color: theme.colors.text }}>{exp.title} at {exp.company}</Text>
                          <Text style={{ fontSize: 11, color: theme.colors.muted }}>{exp.duration}</Text>
                          <Text style={{ fontSize: 13, color: theme.colors.text, lineHeight: 18 }}>{exp.desc}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {resume.projects.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.previewSection}>PROJECTS</Text>
                      {resume.projects.map((proj, i) => (
                        <View key={i} style={{ gap: 2 }}>
                          <Text style={{ fontWeight: '700', color: theme.colors.text }}>{proj.name}</Text>
                          <Text style={{ fontSize: 13, color: theme.colors.text, lineHeight: 18 }}>{proj.desc}</Text>
                          <Text style={{ fontSize: 11, color: theme.colors.brand }}>{proj.tech}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {resume.certifications.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.previewSection}>CERTIFICATIONS</Text>
                      {resume.certifications.map((c, i) => (
                        <Text key={i} style={{ fontSize: 13, color: theme.colors.text }}>• {c}</Text>
                      ))}
                    </View>
                  )}
                </Card>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><GradientButton label="Edit Resume" onPress={() => setPreview(false)} /></View>
                  <View style={{ flex: 1 }}><GradientButton label="Download Resume" onPress={handleDownloadPDF} /></View>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.brand + '40' },
  skillTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brandTertiary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: theme.colors.brand + '20' },
  previewSection: { fontSize: 11, fontWeight: '800', color: theme.colors.brand, letterSpacing: 1 },
});
