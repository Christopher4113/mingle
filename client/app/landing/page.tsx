import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Calendar, Sparkles, Network, Heart, Zap } from "lucide-react"

export default function MingleLanding() {
  return (
    <div className="min-h-screen">
      {/* Hero Section with Gradient Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-pink-500 to-purple-600"></div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-32 w-24 h-24 bg-white rounded-full blur-lg animate-bounce"></div>
          <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-white rounded-full blur-2xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 text-balance">Connect Like Never Before</h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed text-pretty">
            Mingle is your AI-powered networking companion that helps you create meaningful connections, discover
            exciting events, and build your social circle with intelligent recommendations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-white/90 text-lg px-8 py-6 rounded-full font-semibold shadow-2xl"
            >
              Sign Up Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-6 rounded-full font-semibold bg-transparent"
            >
              Login
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-blue-500 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                Mingle
              </span>
            </h2>
            <p className="text-xl text-muted-foreground text-pretty">
              Discover, connect, and grow your network with AI-powered intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Smart Events</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Create and discover events tailored to your interests. Our AI suggests the perfect gatherings for
                  meaningful connections.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Connect Instantly</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Meet like-minded people in your area. Our matching algorithm connects you with people who share your
                  passions and goals.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">AI Recommendations</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get personalized suggestions for events, people, and activities based on your preferences and social
                  patterns.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Network className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Build Your Network</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Expand your professional and personal circles with tools designed to foster genuine, lasting
                  relationships.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Meaningful Connections</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Quality over quantity. Find people who truly align with your values, interests, and life goals.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-pink-500 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Seamless Experience</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Everything you need in one beautiful, intuitive platform. No more juggling multiple apps to stay
                  connected.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-500 via-pink-500 to-purple-600 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full blur-lg"></div>
          <div className="absolute top-32 right-20 w-16 h-16 bg-white rounded-full blur-md"></div>
          <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-white rounded-full blur-xl"></div>
          <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full blur-2xl"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 text-balance">Ready to Start Mingling?</h2>
          <p className="text-xl md:text-2xl text-white/90 mb-10 leading-relaxed text-pretty">
            Join thousands of people who are already building meaningful connections and discovering amazing events.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-white/90 text-xl px-12 py-8 rounded-full font-bold shadow-2xl hover:shadow-3xl transition-all"
            >
              Get Started Today
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white hover:text-purple-600 text-xl px-12 py-8 rounded-full font-bold bg-transparent"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-background border-t">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-6">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-500 via-pink-500 to-purple-600 bg-clip-text text-transparent">
              Mingle
            </h3>
          </div>
          <p className="text-muted-foreground mb-4">Connect. Discover. Grow. Your AI-powered networking companion.</p>
          <p className="text-sm text-muted-foreground">© 2025 Mingle. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
