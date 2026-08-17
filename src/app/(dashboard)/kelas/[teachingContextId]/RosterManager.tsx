"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Upload, Trash2, Edit } from "lucide-react";
import { enrollStudentInClass, removeStudentFromClass } from "@/modules/classes/classes.actions";
import { findOrCreateStudent, updateStudent } from "@/modules/students/students.actions";
import { useRouter } from "next/navigation";

export default function RosterManager({ 
  teachingContextId, 
  classId, 
  academicPeriodId,
  initialRoster 
}: { 
  teachingContextId: string, 
  classId: string, 
  academicPeriodId: string,
  initialRoster: any[] 
}) {
  const router = useRouter();
  const [roster, setRoster] = useState(initialRoster);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  const [formData, setFormData] = useState({ fullName: "", nis: "" });
  const [loading, setLoading] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await findOrCreateStudent({ fullName: formData.fullName, nis: formData.nis });
      
      if (res.warning) {
        toast.warning(res.warning);
      }

      await enrollStudentInClass(classId, res.student.id, academicPeriodId);
      
      toast.success("Siswa berhasil ditambahkan ke kelas");
      setIsAddOpen(false);
      setFormData({ fullName: "", nis: "" });
      router.refresh(); 
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan siswa");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateStudent(selectedStudent.studentId, { fullName: formData.fullName, nis: formData.nis });
      toast.success("Siswa berhasil diubah");
      setIsEditOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah siswa");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (!confirm("Hapus siswa dari kelas ini? (Data riwayat pembelajaran mungkin hilang jika dihapus)")) return;
    
    try {
      await removeStudentFromClass(studentId, academicPeriodId);
      toast.success("Siswa dihapus dari kelas");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus siswa");
    }
  };

  const openEdit = (student: any) => {
    setSelectedStudent(student);
    setFormData({ fullName: student.student.fullName, nis: student.student.nis || "" });
    setIsEditOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daftar Siswa ({roster.length})</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/kelas/${teachingContextId}/import`)}>
            <Upload className="mr-2 h-4 w-4" /> Import Excel
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Siswa
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Siswa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Lengkap</label>
                  <Input 
                    value={formData.fullName} 
                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">NIS (Opsional)</label>
                  <Input 
                    value={formData.nis} 
                    onChange={e => setFormData({...formData, nis: e.target.value})} 
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ubah Data Siswa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Lengkap</label>
                  <Input 
                    value={formData.fullName} 
                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">NIS (Opsional)</label>
                  <Input 
                    value={formData.nis} 
                    onChange={e => setFormData({...formData, nis: e.target.value})} 
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead>NIS</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-medium">{item.student.fullName}</TableCell>
                <TableCell>{item.student.nis || "-"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleRemove(item.studentId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {roster.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Belum ada siswa di kelas ini.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
