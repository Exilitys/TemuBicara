import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Target,
  Heart,
  Lightbulb,
  Globe,
  MessageSquare,
  Instagram,
  Linkedin,
  Mail,
  GraduationCap,
} from "lucide-react";

const AboutUs = () => {
  const teamMembers = [
    {
      name: "Jonathan Carlo",
      university: "Bina Nusantara University",
      major: "Computer Science",
      role: "Lead Developer & Founder",
      description:
        "Passionate about building scalable web applications and connecting communities through technology.",
      avatar: "/carlo.png",
      instagram: "@jonathancarlo20",
      linkedin: "jonathan-carlo",
      instagramLink: "https://www.instagram.com/jonathancarlo20/",
      linkedinLink: "https://www.linkedin.com/in/jonathan-carlo-670b73233/",
      email: "jonathan.carlo20@gmail.com",
    },
    {
      name: "Christopher Bryan",
      university: "Bina Nusantara University",
      major: "Computer Science",
      role: "Full-Stack Developer & Co-Founder",
      description:
        "Focused on creating seamless user experiences and robust backend systems for modern applications.",
      avatar: "/bryan.jpg",
      instagram: "@christopher_bryansh",
      linkedin: "christo...",
      instagramLink:
        "https://www.instagram.com/christopher_bryansh?utm_source=qr&igsh=MWluOXY4OTQzMDdpNw==",
      linkedinLink: "https://www.linkedin.com/feed/?trk=onboarding-landing",
      email: "christopher.bryansh@gmail.com",
    },
    {
      name: "Julian Sudiyanto",
      university: "Telkom University",
      major: "Data Science",
      role: "Full Stack Developer & Co-Founder",
      description:
        "Specializes in data analytics and machine learning to drive intelligent platform recommendations.",
      avatar: "/julian.png",
      instagram: "@Itdjoel",
      linkedin: "julian-sudiyanto",
      instagramLink:
        "https://www.instagram.com/itdjoel?igsh=NjExbHR5ZGVreGd5&utm_source=qr",
      linkedinLink: "https://www.linkedin.com/in/julian-sudianto-536a1430b/",
      email: "juliansudianto0504@gmail.com",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">About TemuBicara</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Connecting inspiring speakers with meaningful events across
            Indonesia, one conversation at a time.
          </p>
        </div>

        {/* Vision Section */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              <Target className="mr-3 h-6 w-6 text-primary" />
              Our Vision & Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" />
                  Our Vision
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  To become Indonesia's premier platform for connecting talented
                  speakers with event organizers, fostering knowledge sharing,
                  and building stronger communities through meaningful
                  conversations and presentations.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Heart className="mr-2 h-5 w-5 text-red-500" />
                  Why We Created TemuBicara
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  We recognized the challenge many event organizers face in
                  finding quality speakers, while talented individuals struggle
                  to find speaking opportunities. TemuBicara bridges this gap,
                  creating a seamless ecosystem where knowledge, experience, and
                  passion meet the right audience.
                </p>
              </div>
            </div>

            <div className="bg-muted/50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <Globe className="mr-2 h-5 w-5 text-blue-500" />
                Our Impact
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Through TemuBicara, we're democratizing access to quality
                speakers and speaking opportunities. Whether it's a corporate
                seminar, educational workshop, or community event, our platform
                ensures that every event has the potential to inspire, educate,
                and transform lives through the power of effective
                communication.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="text-center">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Whether you're looking for the perfect speaker for your event or
              wanting to share your expertise with others, TemuBicara is here to
              help you make meaningful connections.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="sm:w-auto">
                <MessageSquare className="mr-2 h-4 w-4" />
                Find Speakers
              </Button>
              <Button variant="outline" size="lg" className="sm:w-auto">
                <Users className="mr-2 h-4 w-4" />
                Become a Speaker
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AboutUs;
